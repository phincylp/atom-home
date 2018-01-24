(function() {
  var log;

  log = require('./log');

  module.exports = {
    selector: '.source.python',
    disableForSelector: '.source.python .comment, .source.python .string',
    inclusionPriority: 2,
    suggestionPriority: atom.config.get('autocomplete-python.suggestionPriority'),
    excludeLowerPriority: false,
    cacheSize: 10,
    _addEventListener: function(editor, eventName, handler) {
      var disposable, editorView;
      editorView = atom.views.getView(editor);
      editorView.addEventListener(eventName, handler);
      disposable = new this.Disposable(function() {
        log.debug('Unsubscribing from event listener ', eventName, handler);
        return editorView.removeEventListener(eventName, handler);
      });
      return disposable;
    },
    _noExecutableError: function(error) {
      if (this.providerNoExecutable) {
        return;
      }
      log.warning('No python executable found', error);
      atom.notifications.addWarning('autocomplete-python unable to find python binary.', {
        detail: "Please set path to python executable manually in package\nsettings and restart your editor. Be sure to migrate on new settings\nif everything worked on previous version.\nDetailed error message: " + error + "\n\nCurrent config: " + (atom.config.get('autocomplete-python.pythonPaths')),
        dismissable: true
      });
      return this.providerNoExecutable = true;
    },
    _spawnDaemon: function() {
      var interpreter, ref;
      interpreter = this.InterpreterLookup.getInterpreter();
      log.debug('Using interpreter', interpreter);
      this.provider = new this.BufferedProcess({
        command: interpreter || 'python',
        args: [__dirname + '/completion.py'],
        stdout: (function(_this) {
          return function(data) {
            return _this._deserialize(data);
          };
        })(this),
        stderr: (function(_this) {
          return function(data) {
            var ref, requestId, resolve, results1;
            if (data.indexOf('is not recognized as an internal or external') > -1) {
              return _this._noExecutableError(data);
            }
            log.debug("autocomplete-python traceback output: " + data);
            if (data.indexOf('jedi') > -1) {
              if (atom.config.get('autocomplete-python.outputProviderErrors')) {
                atom.notifications.addWarning('Looks like this error originated from Jedi. Please do not\nreport such issues in autocomplete-python issue tracker. Report\nthem directly to Jedi. Turn off `outputProviderErrors` setting\nto hide such errors in future. Traceback output:', {
                  detail: "" + data,
                  dismissable: true
                });
              }
            } else {
              atom.notifications.addError('autocomplete-python traceback output:', {
                detail: "" + data,
                dismissable: true
              });
            }
            log.debug("Forcing to resolve " + (Object.keys(_this.requests).length) + " promises");
            ref = _this.requests;
            results1 = [];
            for (requestId in ref) {
              resolve = ref[requestId];
              if (typeof resolve === 'function') {
                resolve([]);
              }
              results1.push(delete _this.requests[requestId]);
            }
            return results1;
          };
        })(this),
        exit: (function(_this) {
          return function(code) {
            return log.warning('Process exit with', code, _this.provider);
          };
        })(this)
      });
      this.provider.onWillThrowError((function(_this) {
        return function(arg) {
          var error, handle;
          error = arg.error, handle = arg.handle;
          if (error.code === 'ENOENT' && error.syscall.indexOf('spawn') === 0) {
            _this._noExecutableError(error);
            _this.dispose();
            return handle();
          } else {
            throw error;
          }
        };
      })(this));
      if ((ref = this.provider.process) != null) {
        ref.stdin.on('error', function(err) {
          return log.debug('stdin', err);
        });
      }
      return setTimeout((function(_this) {
        return function() {
          log.debug('Killing python process after timeout...');
          if (_this.provider && _this.provider.process) {
            return _this.provider.kill();
          }
        };
      })(this), 60 * 10 * 1000);
    },
    load: function() {
      if (!this.constructed) {
        this.constructor();
      }
      return this;
    },
    constructor: function() {
      var err, ref, selector;
      ref = require('atom'), this.Disposable = ref.Disposable, this.CompositeDisposable = ref.CompositeDisposable, this.BufferedProcess = ref.BufferedProcess;
      this.selectorsMatchScopeChain = require('./scope-helpers').selectorsMatchScopeChain;
      this.Selector = require('selector-kit').Selector;
      this.DefinitionsView = require('./definitions-view');
      this.UsagesView = require('./usages-view');
      this.OverrideView = require('./override-view');
      this.RenameView = require('./rename-view');
      this.InterpreterLookup = require('./interpreters-lookup');
      this._ = require('underscore');
      this.filter = require('fuzzaldrin-plus').filter;
      this._showSignatureOverlay = require('./tooltips')._showSignatureOverlay;
      this.requests = {};
      this.responses = {};
      this.provider = null;
      this.disposables = new this.CompositeDisposable;
      this.subscriptions = {};
      this.definitionsView = null;
      this.usagesView = null;
      this.renameView = null;
      this.constructed = true;
      this.snippetsManager = null;
      log.debug("Init autocomplete-python with priority " + this.suggestionPriority);
      try {
        this.triggerCompletionRegex = RegExp(atom.config.get('autocomplete-python.triggerCompletionRegex'));
      } catch (error1) {
        err = error1;
        atom.notifications.addWarning('autocomplete-python invalid regexp to trigger autocompletions.\nFalling back to default value.', {
          detail: "Original exception: " + err,
          dismissable: true
        });
        atom.config.set('autocomplete-python.triggerCompletionRegex', '([\.\ ]|[a-zA-Z_][a-zA-Z0-9_]*)');
        this.triggerCompletionRegex = /([\.\ ]|[a-zA-Z_][a-zA-Z0-9_]*)/;
      }
      selector = 'atom-text-editor[data-grammar~=python]';
      atom.commands.add(selector, 'autocomplete-python:go-to-definition', (function(_this) {
        return function() {
          return _this.goToDefinition();
        };
      })(this));
      atom.commands.add(selector, 'autocomplete-python:complete-arguments', (function(_this) {
        return function() {
          var editor;
          editor = atom.workspace.getActiveTextEditor();
          return _this._completeArguments(editor, editor.getCursorBufferPosition(), true);
        };
      })(this));
      atom.commands.add(selector, 'autocomplete-python:show-usages', (function(_this) {
        return function() {
          var bufferPosition, editor;
          editor = atom.workspace.getActiveTextEditor();
          bufferPosition = editor.getCursorBufferPosition();
          if (_this.usagesView) {
            _this.usagesView.destroy();
          }
          _this.usagesView = new _this.UsagesView();
          return _this.getUsages(editor, bufferPosition).then(function(usages) {
            return _this.usagesView.setItems(usages);
          });
        };
      })(this));
      atom.commands.add(selector, 'autocomplete-python:override-method', (function(_this) {
        return function() {
          var bufferPosition, editor;
          editor = atom.workspace.getActiveTextEditor();
          bufferPosition = editor.getCursorBufferPosition();
          if (_this.overrideView) {
            _this.overrideView.destroy();
          }
          _this.overrideView = new _this.OverrideView();
          return _this.getMethods(editor, bufferPosition).then(function(arg) {
            var bufferPosition, indent, methods;
            methods = arg.methods, indent = arg.indent, bufferPosition = arg.bufferPosition;
            _this.overrideView.indent = indent;
            _this.overrideView.bufferPosition = bufferPosition;
            return _this.overrideView.setItems(methods);
          });
        };
      })(this));
      atom.commands.add(selector, 'autocomplete-python:rename', (function(_this) {
        return function() {
          var bufferPosition, editor;
          editor = atom.workspace.getActiveTextEditor();
          bufferPosition = editor.getCursorBufferPosition();
          return _this.getUsages(editor, bufferPosition).then(function(usages) {
            if (_this.renameView) {
              _this.renameView.destroy();
            }
            if (usages.length > 0) {
              _this.renameView = new _this.RenameView(usages);
              return _this.renameView.onInput(function(newName) {
                var _relative, fileName, project, ref1, ref2, results1;
                ref1 = _this._.groupBy(usages, 'fileName');
                results1 = [];
                for (fileName in ref1) {
                  usages = ref1[fileName];
                  ref2 = atom.project.relativizePath(fileName), project = ref2[0], _relative = ref2[1];
                  if (project) {
                    results1.push(_this._updateUsagesInFile(fileName, usages, newName));
                  } else {
                    results1.push(log.debug('Ignoring file outside of project', fileName));
                  }
                }
                return results1;
              });
            } else {
              if (_this.usagesView) {
                _this.usagesView.destroy();
              }
              _this.usagesView = new _this.UsagesView();
              return _this.usagesView.setItems(usages);
            }
          });
        };
      })(this));
      atom.workspace.observeTextEditors((function(_this) {
        return function(editor) {
          _this._handleGrammarChangeEvent(editor, editor.getGrammar());
          return editor.onDidChangeGrammar(function(grammar) {
            return _this._handleGrammarChangeEvent(editor, grammar);
          });
        };
      })(this));
      return atom.config.onDidChange('autocomplete-plus.enableAutoActivation', (function(_this) {
        return function() {
          return atom.workspace.observeTextEditors(function(editor) {
            return _this._handleGrammarChangeEvent(editor, editor.getGrammar());
          });
        };
      })(this));
    },
    _updateUsagesInFile: function(fileName, usages, newName) {
      var columnOffset;
      columnOffset = {};
      return atom.workspace.open(fileName, {
        activateItem: false
      }).then(function(editor) {
        var buffer, column, i, len, line, name, usage;
        buffer = editor.getBuffer();
        for (i = 0, len = usages.length; i < len; i++) {
          usage = usages[i];
          name = usage.name, line = usage.line, column = usage.column;
          if (columnOffset[line] == null) {
            columnOffset[line] = 0;
          }
          log.debug('Replacing', usage, 'with', newName, 'in', editor.id);
          log.debug('Offset for line', line, 'is', columnOffset[line]);
          buffer.setTextInRange([[line - 1, column + columnOffset[line]], [line - 1, column + name.length + columnOffset[line]]], newName);
          columnOffset[line] += newName.length - name.length;
        }
        return buffer.save();
      });
    },
    _handleGrammarChangeEvent: function(editor, grammar) {
      var disposable, eventId, eventName;
      eventName = 'keyup';
      eventId = editor.id + "." + eventName;
      if (grammar.scopeName === 'source.python') {
        if (atom.config.get('autocomplete-python.showTooltips') === true) {
          editor.onDidChangeCursorPosition((function(_this) {
            return function(event) {
              return _this._showSignatureOverlay(event, _this);
            };
          })(this));
        }
        if (!atom.config.get('autocomplete-plus.enableAutoActivation')) {
          log.debug('Ignoring keyup events due to autocomplete-plus settings.');
          return;
        }
        disposable = this._addEventListener(editor, eventName, (function(_this) {
          return function(e) {
            if (atom.keymaps.keystrokeForKeyboardEvent(e) === '^(') {
              log.debug('Trying to complete arguments on keyup event', e);
              return _this._completeArguments(editor, editor.getCursorBufferPosition());
            }
          };
        })(this));
        this.disposables.add(disposable);
        this.subscriptions[eventId] = disposable;
        return log.debug('Subscribed on event', eventId);
      } else {
        if (eventId in this.subscriptions) {
          this.subscriptions[eventId].dispose();
          return log.debug('Unsubscribed from event', eventId);
        }
      }
    },
    _serialize: function(request) {
      log.debug('Serializing request to be sent to Jedi', request);
      return JSON.stringify(request);
    },
    _sendRequest: function(data, respawned) {
      var process;
      log.debug('Pending requests:', Object.keys(this.requests).length, this.requests);
      if (Object.keys(this.requests).length > 10) {
        log.debug('Cleaning up request queue to avoid overflow, ignoring request');
        this.requests = {};
        if (this.provider && this.provider.process) {
          log.debug('Killing python process');
          this.provider.kill();
          return;
        }
      }
      if (this.provider && this.provider.process) {
        process = this.provider.process;
        if (process.exitCode === null && process.signalCode === null) {
          if (this.provider.process.pid) {
            return this.provider.process.stdin.write(data + '\n');
          } else {
            return log.debug('Attempt to communicate with terminated process', this.provider);
          }
        } else if (respawned) {
          atom.notifications.addWarning(["Failed to spawn daemon for autocomplete-python.", "Completions will not work anymore", "unless you restart your editor."].join(' '), {
            detail: ["exitCode: " + process.exitCode, "signalCode: " + process.signalCode].join('\n'),
            dismissable: true
          });
          return this.dispose();
        } else {
          this._spawnDaemon();
          this._sendRequest(data, {
            respawned: true
          });
          return log.debug('Re-spawning python process...');
        }
      } else {
        log.debug('Spawning python process...');
        this._spawnDaemon();
        return this._sendRequest(data);
      }
    },
    _deserialize: function(response) {
      var bufferPosition, cacheSizeDelta, e, editor, i, id, ids, j, len, len1, ref, ref1, ref2, resolve, responseSource, results1;
      log.debug('Deserealizing response from Jedi', response);
      log.debug("Got " + (response.trim().split('\n').length) + " lines");
      ref = response.trim().split('\n');
      results1 = [];
      for (i = 0, len = ref.length; i < len; i++) {
        responseSource = ref[i];
        try {
          response = JSON.parse(responseSource);
        } catch (error1) {
          e = error1;
          throw new Error("Failed to parse JSON from \"" + responseSource + "\".\nOriginal exception: " + e);
        }
        if (response['arguments']) {
          editor = this.requests[response['id']];
          if (typeof editor === 'object') {
            bufferPosition = editor.getCursorBufferPosition();
            if (response['id'] === this._generateRequestId('arguments', editor, bufferPosition)) {
              if ((ref1 = this.snippetsManager) != null) {
                ref1.insertSnippet(response['arguments'], editor);
              }
            }
          }
        } else {
          resolve = this.requests[response['id']];
          if (typeof resolve === 'function') {
            resolve(response['results']);
          }
        }
        cacheSizeDelta = Object.keys(this.responses).length > this.cacheSize;
        if (cacheSizeDelta > 0) {
          ids = Object.keys(this.responses).sort((function(_this) {
            return function(a, b) {
              return _this.responses[a]['timestamp'] - _this.responses[b]['timestamp'];
            };
          })(this));
          ref2 = ids.slice(0, cacheSizeDelta);
          for (j = 0, len1 = ref2.length; j < len1; j++) {
            id = ref2[j];
            log.debug('Removing old item from cache with ID', id);
            delete this.responses[id];
          }
        }
        this.responses[response['id']] = {
          source: responseSource,
          timestamp: Date.now()
        };
        log.debug('Cached request with ID', response['id']);
        results1.push(delete this.requests[response['id']]);
      }
      return results1;
    },
    _generateRequestId: function(type, editor, bufferPosition, text) {
      if (!text) {
        text = editor.getText();
      }
      return require('crypto').createHash('md5').update([editor.getPath(), text, bufferPosition.row, bufferPosition.column, type].join()).digest('hex');
    },
    _generateRequestConfig: function() {
      var args, extraPaths;
      extraPaths = this.InterpreterLookup.applySubstitutions(atom.config.get('autocomplete-python.extraPaths').split(';'));
      args = {
        'extraPaths': extraPaths,
        'useSnippets': atom.config.get('autocomplete-python.useSnippets'),
        'caseInsensitiveCompletion': atom.config.get('autocomplete-python.caseInsensitiveCompletion'),
        'showDescriptions': atom.config.get('autocomplete-python.showDescriptions'),
        'fuzzyMatcher': atom.config.get('autocomplete-python.fuzzyMatcher')
      };
      return args;
    },
    setSnippetsManager: function(snippetsManager) {
      this.snippetsManager = snippetsManager;
    },
    _completeArguments: function(editor, bufferPosition, force) {
      var disableForSelector, line, lines, payload, prefix, scopeChain, scopeDescriptor, suffix, useSnippets;
      useSnippets = atom.config.get('autocomplete-python.useSnippets');
      if (!force && useSnippets === 'none') {
        atom.commands.dispatch(document.querySelector('atom-text-editor'), 'autocomplete-plus:activate');
        return;
      }
      scopeDescriptor = editor.scopeDescriptorForBufferPosition(bufferPosition);
      scopeChain = scopeDescriptor.getScopeChain();
      disableForSelector = this.Selector.create(this.disableForSelector);
      if (this.selectorsMatchScopeChain(disableForSelector, scopeChain)) {
        log.debug('Ignoring argument completion inside of', scopeChain);
        return;
      }
      lines = editor.getBuffer().getLines();
      line = lines[bufferPosition.row];
      prefix = line.slice(bufferPosition.column - 1, bufferPosition.column);
      if (prefix !== '(') {
        log.debug('Ignoring argument completion with prefix', prefix);
        return;
      }
      suffix = line.slice(bufferPosition.column, line.length);
      if (!/^(\)(?:$|\s)|\s|$)/.test(suffix)) {
        log.debug('Ignoring argument completion with suffix', suffix);
        return;
      }
      payload = {
        id: this._generateRequestId('arguments', editor, bufferPosition),
        lookup: 'arguments',
        path: editor.getPath(),
        source: editor.getText(),
        line: bufferPosition.row,
        column: bufferPosition.column,
        config: this._generateRequestConfig()
      };
      this._sendRequest(this._serialize(payload));
      return new Promise((function(_this) {
        return function() {
          return _this.requests[payload.id] = editor;
        };
      })(this));
    },
    _fuzzyFilter: function(candidates, query) {
      if (candidates.length !== 0 && (query !== ' ' && query !== '.' && query !== '(')) {
        candidates = this.filter(candidates, query, {
          key: 'text'
        });
      }
      return candidates;
    },
    getSuggestions: function(arg) {
      var bufferPosition, editor, lastIdentifier, line, lines, matches, payload, prefix, requestId, scopeDescriptor;
      editor = arg.editor, bufferPosition = arg.bufferPosition, scopeDescriptor = arg.scopeDescriptor, prefix = arg.prefix;
      this.load();
      if (!this.triggerCompletionRegex.test(prefix)) {
        return this.lastSuggestions = [];
      }
      bufferPosition = {
        row: bufferPosition.row,
        column: bufferPosition.column
      };
      lines = editor.getBuffer().getLines();
      if (atom.config.get('autocomplete-python.fuzzyMatcher')) {
        line = lines[bufferPosition.row];
        lastIdentifier = /\.?[a-zA-Z_][a-zA-Z0-9_]*$/.exec(line.slice(0, bufferPosition.column));
        if (lastIdentifier) {
          bufferPosition.column = lastIdentifier.index + 1;
          lines[bufferPosition.row] = line.slice(0, bufferPosition.column);
        }
      }
      requestId = this._generateRequestId('completions', editor, bufferPosition, lines.join('\n'));
      if (requestId in this.responses) {
        log.debug('Using cached response with ID', requestId);
        matches = JSON.parse(this.responses[requestId]['source'])['results'];
        if (atom.config.get('autocomplete-python.fuzzyMatcher')) {
          return this.lastSuggestions = this._fuzzyFilter(matches, prefix);
        } else {
          return this.lastSuggestions = matches;
        }
      }
      payload = {
        id: requestId,
        prefix: prefix,
        lookup: 'completions',
        path: editor.getPath(),
        source: editor.getText(),
        line: bufferPosition.row,
        column: bufferPosition.column,
        config: this._generateRequestConfig()
      };
      this._sendRequest(this._serialize(payload));
      return new Promise((function(_this) {
        return function(resolve) {
          if (atom.config.get('autocomplete-python.fuzzyMatcher')) {
            return _this.requests[payload.id] = function(matches) {
              return resolve(_this.lastSuggestions = _this._fuzzyFilter(matches, prefix));
            };
          } else {
            return _this.requests[payload.id] = function(suggestions) {
              return resolve(_this.lastSuggestions = suggestions);
            };
          }
        };
      })(this));
    },
    getDefinitions: function(editor, bufferPosition) {
      var payload;
      payload = {
        id: this._generateRequestId('definitions', editor, bufferPosition),
        lookup: 'definitions',
        path: editor.getPath(),
        source: editor.getText(),
        line: bufferPosition.row,
        column: bufferPosition.column,
        config: this._generateRequestConfig()
      };
      this._sendRequest(this._serialize(payload));
      return new Promise((function(_this) {
        return function(resolve) {
          return _this.requests[payload.id] = resolve;
        };
      })(this));
    },
    getUsages: function(editor, bufferPosition) {
      var payload;
      payload = {
        id: this._generateRequestId('usages', editor, bufferPosition),
        lookup: 'usages',
        path: editor.getPath(),
        source: editor.getText(),
        line: bufferPosition.row,
        column: bufferPosition.column,
        config: this._generateRequestConfig()
      };
      this._sendRequest(this._serialize(payload));
      return new Promise((function(_this) {
        return function(resolve) {
          return _this.requests[payload.id] = resolve;
        };
      })(this));
    },
    getMethods: function(editor, bufferPosition) {
      var indent, lines, payload;
      indent = bufferPosition.column;
      lines = editor.getBuffer().getLines();
      lines.splice(bufferPosition.row + 1, 0, "  def __autocomplete_python(s):");
      lines.splice(bufferPosition.row + 2, 0, "    s.");
      payload = {
        id: this._generateRequestId('methods', editor, bufferPosition),
        lookup: 'methods',
        path: editor.getPath(),
        source: lines.join('\n'),
        line: bufferPosition.row + 2,
        column: 6,
        config: this._generateRequestConfig()
      };
      this._sendRequest(this._serialize(payload));
      return new Promise((function(_this) {
        return function(resolve) {
          return _this.requests[payload.id] = function(methods) {
            return resolve({
              methods: methods,
              indent: indent,
              bufferPosition: bufferPosition
            });
          };
        };
      })(this));
    },
    goToDefinition: function(editor, bufferPosition) {
      if (!editor) {
        editor = atom.workspace.getActiveTextEditor();
      }
      if (!bufferPosition) {
        bufferPosition = editor.getCursorBufferPosition();
      }
      if (this.definitionsView) {
        this.definitionsView.destroy();
      }
      this.definitionsView = new this.DefinitionsView();
      return this.getDefinitions(editor, bufferPosition).then((function(_this) {
        return function(results) {
          _this.definitionsView.setItems(results);
          if (results.length === 1) {
            return _this.definitionsView.confirmed(results[0]);
          }
        };
      })(this));
    },
    dispose: function() {
      if (this.disposables) {
        this.disposables.dispose();
      }
      if (this.provider) {
        return this.provider.kill();
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3BwaW91cy8uYXRvbS9wYWNrYWdlcy9hdXRvY29tcGxldGUtcHl0aG9uL2xpYi9wcm92aWRlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFBLEdBQUEsR0FBTSxPQUFBLENBQVEsT0FBUjs7RUFFTixNQUFNLENBQUMsT0FBUCxHQUNFO0lBQUEsUUFBQSxFQUFVLGdCQUFWO0lBQ0Esa0JBQUEsRUFBb0IsaURBRHBCO0lBRUEsaUJBQUEsRUFBbUIsQ0FGbkI7SUFHQSxrQkFBQSxFQUFvQixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQVosQ0FBZ0Isd0NBQWhCLENBSHBCO0lBSUEsb0JBQUEsRUFBc0IsS0FKdEI7SUFLQSxTQUFBLEVBQVcsRUFMWDtJQU9BLGlCQUFBLEVBQW1CLFNBQUMsTUFBRCxFQUFTLFNBQVQsRUFBb0IsT0FBcEI7QUFDakIsVUFBQTtNQUFBLFVBQUEsR0FBYSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQVgsQ0FBbUIsTUFBbkI7TUFDYixVQUFVLENBQUMsZ0JBQVgsQ0FBNEIsU0FBNUIsRUFBdUMsT0FBdkM7TUFDQSxVQUFBLEdBQWEsSUFBSSxJQUFDLENBQUEsVUFBTCxDQUFnQixTQUFBO1FBQzNCLEdBQUcsQ0FBQyxLQUFKLENBQVUsb0NBQVYsRUFBZ0QsU0FBaEQsRUFBMkQsT0FBM0Q7ZUFDQSxVQUFVLENBQUMsbUJBQVgsQ0FBK0IsU0FBL0IsRUFBMEMsT0FBMUM7TUFGMkIsQ0FBaEI7QUFHYixhQUFPO0lBTlUsQ0FQbkI7SUFlQSxrQkFBQSxFQUFvQixTQUFDLEtBQUQ7TUFDbEIsSUFBRyxJQUFDLENBQUEsb0JBQUo7QUFDRSxlQURGOztNQUVBLEdBQUcsQ0FBQyxPQUFKLENBQVksNEJBQVosRUFBMEMsS0FBMUM7TUFDQSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQW5CLENBQ0UsbURBREYsRUFDdUQ7UUFDckQsTUFBQSxFQUFRLHFN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ZUFBRCxHQUFtQixJQUFJLElBQUMsQ0FBQSxlQUFMLENBQUE7YUFDbkIsSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsTUFBaEIsRUFBd0IsY0FBeEIsQ0FBdUMsQ0FBQyxJQUF4QyxDQUE2QyxDQUFBLFNBQUEsS0FBQTtlQUFBLFNBQUMsT0FBRDtVQUMzQyxLQUFDLENBQUEsZUFBZSxDQUFDLFFBQWpCLENBQTBCLE9BQTFCO1VBQ0EsSUFBRyxPQUFPLENBQUMsTUFBUixLQUFrQixDQUFyQjttQkFDRSxLQUFDLENBQUEsZUFBZSxDQUFDLFNBQWpCLENBQTJCLE9BQVEsQ0FBQSxDQUFBLENBQW5DLEVBREY7O1FBRjJDO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUE3QztJQVJjLENBdGNoQjtJQW1kQSxPQUFBLEVBQVMsU0FBQTtNQUNQLElBQUcsSUFBQyxDQUFBLFdBQUo7UUFDRSxJQUFDLENBQUEsV0FBVyxDQUFDLE9BQWIsQ0FBQSxFQURGOztNQUVBLElBQUcsSUFBQyxDQUFBLFFBQUo7ZUFDRSxJQUFDLENBQUEsUUFBUSxDQUFDLElBQVYsQ0FBQSxFQURGOztJQUhPLENBbmRUOztBQUhGIiwic291cmNlc0NvbnRlbnQiOlsibG9nID0gcmVxdWlyZSAnLi9sb2cnXG5cbm1vZHVsZS5leHBvcnRzID1cbiAgc2VsZWN0b3I6ICcuc291cmNlLnB5dGhvbidcbiAgZGlzYWJsZUZvclNlbGVjdG9yOiAnLnNvdXJjZS5weXRob24gLmNvbW1lbnQsIC5zb3VyY2UucHl0aG9uIC5zdHJpbmcnXG4gIGluY2x1c2lvblByaW9yaXR5OiAyXG4gIHN1Z2dlc3Rpb25Qcmlvcml0eTogYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLnN1Z2dlc3Rpb25Qcmlvcml0eScpXG4gIGV4Y2x1ZGVMb3dlclByaW9yaXR5OiBmYWxzZVxuICBjYWNoZVNpemU6IDEwXG5cbiAgX2FkZEV2ZW50TGlzdGVuZXI6IChlZGl0b3IsIGV2ZW50TmFtZSwgaGFuZGxlcikgLT5cbiAgICBlZGl0b3JWaWV3ID0gYXRvbS52aWV3cy5nZXRWaWV3IGVkaXRvclxuICAgIGVkaXRvclZpZXcuYWRkRXZlbnRMaXN0ZW5lciBldmVudE5hbWUsIGhhbmRsZXJcbiAgICBkaXNwb3NhYmxlID0gbmV3IEBEaXNwb3NhYmxlIC0+XG4gICAgICBsb2cuZGVidWcgJ1Vuc3Vic2NyaWJpbmcgZnJvbSBldmVudCBsaXN0ZW5lciAnLCBldmVudE5hbWUsIGhhbmRsZXJcbiAgICAgIGVkaXRvclZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lciBldmVudE5hbWUsIGhhbmRsZXJcbiAgICByZXR1cm4gZGlzcG9zYWJsZVxuXG4gIF9ub0V4ZWN1dGFibGVFcnJvcjogKGVycm9yKSAtPlxuICAgIGlmIEBwcm92aWRlck5vRXhlY3V0YWJsZVxuICAgICAgcmV0dXJuXG4gICAgbG9nLndhcm5pbmcgJ05vIHB5dGhvbiBleGVjdXRhYmxlIGZvdW5kJywgZXJyb3JcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICdhdXRvY29tcGxldGUtcHl0aG9uIHVuYWJsZSB0byBmaW5kIHB5dGhvbiBiaW5hcnkuJywge1xuICAgICAgZGV0YWlsOiBcIlwiXCJQbGVhc2Ugc2V0IHBhdGggdG8gcHl0aG9uIGV4ZWN1dGFibGUgbWFudWFsbHkgaW4gcGFja2FnZVxuICAgICAgc2V0dGluZ3MgYW5kIHJlc3RhcnQgeW91ciBlZGl0b3IuIEJlIHN1cmUgdG8gbWlncmF0ZSBvbiBuZXcgc2V0dGluZ3NcbiAgICAgIGlmIGV2ZXJ5dGhpbmcgd29ya2VkIG9uIHByZXZpb3VzIHZlcnNpb24uXG4gICAgICBEZXRhaWxlZCBlcnJvciBtZXNzYWdlOiAje2Vycm9yfVxuXG4gICAgICBDdXJyZW50IGNvbmZpZzogI3thdG9tLmNvbmZpZy5nZXQoJ2F1dG9jb21wbGV0ZS1weXRob24ucHl0aG9uUGF0aHMnKX1cIlwiXCJcbiAgICAgIGRpc21pc3NhYmxlOiB0cnVlfSlcbiAgICBAcHJvdmlkZXJOb0V4ZWN1dGFibGUgPSB0cnVlXG5cbiAgX3NwYXduRGFlbW9uOiAtPlxuICAgIGludGVycHJldGVyID0gQEludGVycHJldGVyTG9va3VwLmdldEludGVycHJldGVyKClcbiAgICBsb2cuZGVidWcgJ1VzaW5nIGludGVycHJldGVyJywgaW50ZXJwcmV0ZXJcbiAgICBAcHJvdmlkZXIgPSBuZXcgQEJ1ZmZlcmVkUHJvY2Vzc1xuICAgICAgY29tbWFuZDogaW50ZXJwcmV0ZXIgb3IgJ3B5dGhvbidcbiAgICAgIGFyZ3M6IFtfX2Rpcm5hbWUgKyAnL2NvbXBsZXRpb24ucHknXVxuICAgICAgc3Rkb3V0OiAoZGF0YSkgPT5cbiAgICAgICAgQF9kZXNlcmlhbGl6ZShkYXRhKVxuICAgICAgc3RkZXJyOiAoZGF0YSkgPT5cbiAgICAgICAgaWYgZGF0YS5pbmRleE9mKCdpcyBub3QgcmVjb2duaXplZCBhcyBhbiBpbnRlcm5hbCBvciBleHRlcm5hbCcpID4gLTFcbiAgICAgICAgICByZXR1cm4gQF9ub0V4ZWN1dGFibGVFcnJvcihkYXRhKVxuICAgICAgICBsb2cuZGVidWcgXCJhdXRvY29tcGxldGUtcHl0aG9uIHRyYWNlYmFjayBvdXRwdXQ6ICN7ZGF0YX1cIlxuICAgICAgICBpZiBkYXRhLmluZGV4T2YoJ2plZGknKSA+IC0xXG4gICAgICAgICAgaWYgYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLm91dHB1dFByb3ZpZGVyRXJyb3JzJylcbiAgICAgICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgICAgICAgICAnJydMb29rcyBsaWtlIHRoaXMgZXJyb3Igb3JpZ2luYXRlZCBmcm9tIEplZGkuIFBsZWFzZSBkbyBub3RcbiAgICAgICAgICAgICAgcmVwb3J0IHN1Y2ggaXNzdWVzIGluIGF1dG9jb21wbGV0ZS1weXRob24gaXNzdWUgdHJhY2tlci4gUmVwb3J0XG4gICAgICAgICAgICAgIHRoZW0gZGlyZWN0bHkgdG8gSmVkaS4gVHVybiBvZmYgYG91dHB1dFByb3ZpZGVyRXJyb3JzYCBzZXR0aW5nXG4gICAgICAgICAgICAgIHRvIGhpZGUgc3VjaCBlcnJvcnMgaW4gZnV0dXJlLiBUcmFjZWJhY2sgb3V0cHV0OicnJywge1xuICAgICAgICAgICAgICBkZXRhaWw6IFwiI3tkYXRhfVwiLFxuICAgICAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZX0pXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoXG4gICAgICAgICAgICAnYXV0b2NvbXBsZXRlLXB5dGhvbiB0cmFjZWJhY2sgb3V0cHV0OicsIHtcbiAgICAgICAgICAgICAgZGV0YWlsOiBcIiN7ZGF0YX1cIixcbiAgICAgICAgICAgICAgZGlzbWlzc2FibGU6IHRydWV9KVxuXG4gICAgICAgIGxvZy5kZWJ1ZyBcIkZvcmNpbmcgdG8gcmVzb2x2ZSAje09iamVjdC5rZXlzKEByZXF1ZXN0cykubGVuZ3RofSBwcm9taXNlc1wiXG4gICAgICAgIGZvciByZXF1ZXN0SWQsIHJlc29sdmUgb2YgQHJlcXVlc3RzXG4gICAgICAgICAgaWYgdHlwZW9mIHJlc29sdmUgPT0gJ2Z1bmN0aW9uJ1xuICAgICAgICAgICAgcmVzb2x2ZShbXSlcbiAgICAgICAgICBkZWxldGUgQHJlcXVlc3RzW3JlcXVlc3RJZF1cblxuICAgICAgZXhpdDogKGNvZGUpID0+XG4gICAgICAgIGxvZy53YXJuaW5nICdQcm9jZXNzIGV4aXQgd2l0aCcsIGNvZGUsIEBwcm92aWRlclxuICAgIEBwcm92aWRlci5vbldpbGxUaHJvd0Vycm9yICh7ZXJyb3IsIGhhbmRsZX0pID0+XG4gICAgICBpZiBlcnJvci5jb2RlIGlzICdFTk9FTlQnIGFuZCBlcnJvci5zeXNjYWxsLmluZGV4T2YoJ3NwYXduJykgaXMgMFxuICAgICAgICBAX25vRXhlY3V0YWJsZUVycm9yKGVycm9yKVxuICAgICAgICBAZGlzcG9zZSgpXG4gICAgICAgIGhhbmRsZSgpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IGVycm9yXG5cbiAgICBAcHJvdmlkZXIucHJvY2Vzcz8uc3RkaW4ub24gJ2Vycm9yJywgKGVycikgLT5cbiAgICAgIGxvZy5kZWJ1ZyAnc3RkaW4nLCBlcnJcblxuICAgIHNldFRpbWVvdXQgPT5cbiAgICAgIGxvZy5kZWJ1ZyAnS2lsbGluZyBweXRob24gcHJvY2VzcyBhZnRlciB0aW1lb3V0Li4uJ1xuICAgICAgaWYgQHByb3ZpZGVyIGFuZCBAcHJvdmlkZXIucHJvY2Vzc1xuICAgICAgICBAcHJvdmlkZXIua2lsbCgpXG4gICAgLCA2MCAqIDEwICogMTAwMFxuXG4gIGxvYWQ6IC0+XG4gICAgaWYgbm90IEBjb25zdHJ1Y3RlZFxuICAgICAgQGNvbnN0cnVjdG9yKClcbiAgICByZXR1cm4gdGhpc1xuXG4gIGNvbnN0cnVjdG9yOiAoKSAtPlxuICAgIHtARGlzcG9zYWJsZSwgQENvbXBvc2l0ZURpc3Bvc2FibGUsIEBCdWZmZXJlZFByb2Nlc3N9ID0gcmVxdWlyZSAnYXRvbSdcbiAgICB7QHNlbGVjdG9yc01hdGNoU2NvcGVDaGFpbn0gPSByZXF1aXJlICcuL3Njb3BlLWhlbHBlcnMnXG4gICAge0BTZWxlY3Rvcn0gPSByZXF1aXJlICdzZWxlY3Rvci1raXQnXG4gICAgQERlZmluaXRpb25zVmlldyA9IHJlcXVpcmUgJy4vZGVmaW5pdGlvbnMtdmlldydcbiAgICBAVXNhZ2VzVmlldyA9IHJlcXVpcmUgJy4vdXNhZ2VzLXZpZXcnXG4gICAgQE92ZXJyaWRlVmlldyA9IHJlcXVpcmUgJy4vb3ZlcnJpZGUtdmlldydcbiAgICBAUmVuYW1lVmlldyA9IHJlcXVpcmUgJy4vcmVuYW1lLXZpZXcnXG4gICAgQEludGVycHJldGVyTG9va3VwID0gcmVxdWlyZSAnLi9pbnRlcnByZXRlcnMtbG9va3VwJ1xuICAgIEBfID0gcmVxdWlyZSAndW5kZXJzY29yZSdcbiAgICBAZmlsdGVyID0gcmVxdWlyZSgnZnV6emFsZHJpbi1wbHVzJykuZmlsdGVyXG4gICAge0Bfc2hvd1NpZ25hdHVyZU92ZXJsYXl9ID0gcmVxdWlyZSAnLi90b29sdGlwcydcblxuICAgIEByZXF1ZXN0cyA9IHt9XG4gICAgQHJlc3BvbnNlcyA9IHt9XG4gICAgQHByb3ZpZGVyID0gbnVsbFxuICAgIEBkaXNwb3NhYmxlcyA9IG5ldyBAQ29tcG9zaXRlRGlzcG9zYWJsZVxuICAgIEBzdWJzY3JpcHRpb25zID0ge31cbiAgICBAZGVmaW5pdGlvbnNWaWV3ID0gbnVsbFxuICAgIEB1c2FnZXNWaWV3ID0gbnVsbFxuICAgIEByZW5hbWVWaWV3ID0gbnVsbFxuICAgIEBjb25zdHJ1Y3RlZCA9IHRydWVcbiAgICBAc25pcHBldHNNYW5hZ2VyID0gbnVsbFxuXG4gICAgbG9nLmRlYnVnIFwiSW5pdCBhdXRvY29tcGxldGUtcHl0aG9uIHdpdGggcHJpb3JpdHkgI3tAc3VnZ2VzdGlvblByaW9yaXR5fVwiXG5cbiAgICB0cnlcbiAgICAgIEB0cmlnZ2VyQ29tcGxldGlvblJlZ2V4ID0gUmVnRXhwIGF0b20uY29uZmlnLmdldChcbiAgICAgICAgJ2F1dG9jb21wbGV0ZS1weXRob24udHJpZ2dlckNvbXBsZXRpb25SZWdleCcpXG4gICAgY2F0Y2ggZXJyXG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICAgJycnYXV0b2NvbXBsZXRlLXB5dGhvbiBpbnZhbGlkIHJlZ2V4cCB0byB0cmlnZ2VyIGF1dG9jb21wbGV0aW9ucy5cbiAgICAgICAgRmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgdmFsdWUuJycnLCB7XG4gICAgICAgIGRldGFpbDogXCJPcmlnaW5hbCBleGNlcHRpb246ICN7ZXJyfVwiXG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlfSlcbiAgICAgIGF0b20uY29uZmlnLnNldCgnYXV0b2NvbXBsZXRlLXB5dGhvbi50cmlnZ2VyQ29tcGxldGlvblJlZ2V4JyxcbiAgICAgICAgICAgICAgICAgICAgICAnKFtcXC5cXCBdfFthLXpBLVpfXVthLXpBLVowLTlfXSopJylcbiAgICAgIEB0cmlnZ2VyQ29tcGxldGlvblJlZ2V4ID0gLyhbXFwuXFwgXXxbYS16QS1aX11bYS16QS1aMC05X10qKS9cblxuICAgIHNlbGVjdG9yID0gJ2F0b20tdGV4dC1lZGl0b3JbZGF0YS1ncmFtbWFyfj1weXRob25dJ1xuICAgIGF0b20uY29tbWFuZHMuYWRkIHNlbGVjdG9yLCAnYXV0b2NvbXBsZXRlLXB5dGhvbjpnby10by1kZWZpbml0aW9uJywgPT5cbiAgICAgIEBnb1RvRGVmaW5pdGlvbigpXG4gICAgYXRvbS5jb21tYW5kcy5hZGQgc2VsZWN0b3IsICdhdXRvY29tcGxldGUtcHl0aG9uOmNvbXBsZXRlLWFyZ3VtZW50cycsID0+XG4gICAgICBlZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKClcbiAgICAgIEBfY29tcGxldGVBcmd1bWVudHMoZWRpdG9yLCBlZGl0b3IuZ2V0Q3Vyc29yQnVmZmVyUG9zaXRpb24oKSwgdHJ1ZSlcblxuICAgIGF0b20uY29tbWFuZHMuYWRkIHNlbGVjdG9yLCAnYXV0b2NvbXBsZXRlLXB5dGhvbjpzaG93LXVzYWdlcycsID0+XG4gICAgICBlZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKClcbiAgICAgIGJ1ZmZlclBvc2l0aW9uID0gZWRpdG9yLmdldEN1cnNvckJ1ZmZlclBvc2l0aW9uKClcbiAgICAgIGlmIEB1c2FnZXNWaWV3XG4gICAgICAgIEB1c2FnZXNWaWV3LmRlc3Ryb3koKVxuICAgICAgQHVzYWdlc1ZpZXcgPSBuZXcgQFVzYWdlc1ZpZXcoKVxuICAgICAgQGdldFVzYWdlcyhlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKS50aGVuICh1c2FnZXMpID0+XG4gICAgICAgIEB1c2FnZXNWaWV3LnNldEl0ZW1zKHVzYWdlcylcblxuICAgIGF0b20uY29tbWFuZHMuYWRkIHNlbGVjdG9yLCAnYXV0b2NvbXBsZXRlLXB5dGhvbjpvdmVycmlkZS1tZXRob2QnLCA9PlxuICAgICAgZWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpXG4gICAgICBidWZmZXJQb3NpdGlvbiA9IGVkaXRvci5nZXRDdXJzb3JCdWZmZXJQb3NpdGlvbigpXG4gICAgICBpZiBAb3ZlcnJpZGVWaWV3XG4gICAgICAgIEBvdmVycmlkZVZpZXcuZGVzdHJveSgpXG4gICAgICBAb3ZlcnJpZGVWaWV3ID0gbmV3IEBPdmVycmlkZVZpZXcoKVxuICAgICAgQGdldE1ldGhvZHMoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikudGhlbiAoe21ldGhvZHMsIGluZGVudCwgYnVmZmVyUG9zaXRpb259KSA9PlxuICAgICAgICBAb3ZlcnJpZGVWaWV3LmluZGVudCA9IGluZGVudFxuICAgICAgICBAb3ZlcnJpZGVWaWV3LmJ1ZmZlclBvc2l0aW9uID0gYnVmZmVyUG9zaXRpb25cbiAgICAgICAgQG92ZXJyaWRlVmlldy5zZXRJdGVtcyhtZXRob2RzKVxuXG4gICAgYXRvbS5jb21tYW5kcy5hZGQgc2VsZWN0b3IsICdhdXRvY29tcGxldGUtcHl0aG9uOnJlbmFtZScsID0+XG4gICAgICBlZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKClcbiAgICAgIGJ1ZmZlclBvc2l0aW9uID0gZWRpdG9yLmdldEN1cnNvckJ1ZmZlclBvc2l0aW9uKClcbiAgICAgIEBnZXRVc2FnZXMoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikudGhlbiAodXNhZ2VzKSA9PlxuICAgICAgICBpZiBAcmVuYW1lVmlld1xuICAgICAgICAgIEByZW5hbWVWaWV3LmRlc3Ryb3koKVxuICAgICAgICBpZiB1c2FnZXMubGVuZ3RoID4gMFxuICAgICAgICAgIEByZW5hbWVWaWV3ID0gbmV3IEBSZW5hbWVWaWV3KHVzYWdlcylcbiAgICAgICAgICBAcmVuYW1lVmlldy5vbklucHV0IChuZXdOYW1lKSA9PlxuICAgICAgICAgICAgZm9yIGZpbGVOYW1lLCB1c2FnZXMgb2YgQF8uZ3JvdXBCeSh1c2FnZXMsICdmaWxlTmFtZScpXG4gICAgICAgICAgICAgIFtwcm9qZWN0LCBfcmVsYXRpdmVdID0gYXRvbS5wcm9qZWN0LnJlbGF0aXZpemVQYXRoKGZpbGVOYW1lKVxuICAgICAgICAgICAgICBpZiBwcm9qZWN0XG4gICAgICAgICAgICAgICAgQF91cGRhdGVVc2FnZXNJbkZpbGUoZmlsZU5hbWUsIHVzYWdlcywgbmV3TmFtZSlcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGxvZy5kZWJ1ZyAnSWdub3JpbmcgZmlsZSBvdXRzaWRlIG9mIHByb2plY3QnLCBmaWxlTmFtZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgaWYgQHVzYWdlc1ZpZXdcbiAgICAgICAgICAgIEB1c2FnZXNWaWV3LmRlc3Ryb3koKVxuICAgICAgICAgIEB1c2FnZXNWaWV3ID0gbmV3IEBVc2FnZXNWaWV3KClcbiAgICAgICAgICBAdXNhZ2VzVmlldy5zZXRJdGVtcyh1c2FnZXMpXG5cbiAgICBhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMgKGVkaXRvcikgPT5cbiAgICAgIEBfaGFuZGxlR3JhbW1hckNoYW5nZUV2ZW50KGVkaXRvciwgZWRpdG9yLmdldEdyYW1tYXIoKSlcbiAgICAgIGVkaXRvci5vbkRpZENoYW5nZUdyYW1tYXIgKGdyYW1tYXIpID0+XG4gICAgICAgIEBfaGFuZGxlR3JhbW1hckNoYW5nZUV2ZW50KGVkaXRvciwgZ3JhbW1hcilcblxuICAgIGF0b20uY29uZmlnLm9uRGlkQ2hhbmdlICdhdXRvY29tcGxldGUtcGx1cy5lbmFibGVBdXRvQWN0aXZhdGlvbicsID0+XG4gICAgICBhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMgKGVkaXRvcikgPT5cbiAgICAgICAgQF9oYW5kbGVHcmFtbWFyQ2hhbmdlRXZlbnQoZWRpdG9yLCBlZGl0b3IuZ2V0R3JhbW1hcigpKVxuXG4gIF91cGRhdGVVc2FnZXNJbkZpbGU6IChmaWxlTmFtZSwgdXNhZ2VzLCBuZXdOYW1lKSAtPlxuICAgIGNvbHVtbk9mZnNldCA9IHt9XG4gICAgYXRvbS53b3Jrc3BhY2Uub3BlbihmaWxlTmFtZSwgYWN0aXZhdGVJdGVtOiBmYWxzZSkudGhlbiAoZWRpdG9yKSAtPlxuICAgICAgYnVmZmVyID0gZWRpdG9yLmdldEJ1ZmZlcigpXG4gICAgICBmb3IgdXNhZ2UgaW4gdXNhZ2VzXG4gICAgICAgIHtuYW1lLCBsaW5lLCBjb2x1bW59ID0gdXNhZ2VcbiAgICAgICAgY29sdW1uT2Zmc2V0W2xpbmVdID89IDBcbiAgICAgICAgbG9nLmRlYnVnICdSZXBsYWNpbmcnLCB1c2FnZSwgJ3dpdGgnLCBuZXdOYW1lLCAnaW4nLCBlZGl0b3IuaWRcbiAgICAgICAgbG9nLmRlYnVnICdPZmZzZXQgZm9yIGxpbmUnLCBsaW5lLCAnaXMnLCBjb2x1bW5PZmZzZXRbbGluZV1cbiAgICAgICAgYnVmZmVyLnNldFRleHRJblJhbmdlKFtcbiAgICAgICAgICBbbGluZSAtIDEsIGNvbHVtbiArIGNvbHVtbk9mZnNldFtsaW5lXV0sXG4gICAgICAgICAgW2xpbmUgLSAxLCBjb2x1bW4gKyBuYW1lLmxlbmd0aCArIGNvbHVtbk9mZnNldFtsaW5lXV0sXG4gICAgICAgICAgXSwgbmV3TmFtZSlcbiAgICAgICAgY29sdW1uT2Zmc2V0W2xpbmVdICs9IG5ld05hbWUubGVuZ3RoIC0gbmFtZS5sZW5ndGhcbiAgICAgIGJ1ZmZlci5zYXZlKClcblxuXG4gIF9oYW5kbGVHcmFtbWFyQ2hhbmdlRXZlbnQ6IChlZGl0b3IsIGdyYW1tYXIpIC0+XG4gICAgZXZlbnROYW1lID0gJ2tleXVwJ1xuICAgIGV2ZW50SWQgPSBcIiN7ZWRpdG9yLmlkfS4je2V2ZW50TmFtZX1cIlxuICAgIGlmIGdyYW1tYXIuc2NvcGVOYW1lID09ICdzb3VyY2UucHl0aG9uJ1xuXG4gICAgICBpZiBhdG9tLmNvbmZpZy5nZXQoJ2F1dG9jb21wbGV0ZS1weXRob24uc2hvd1Rvb2x0aXBzJykgaXMgdHJ1ZVxuICAgICAgICBlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbiAoZXZlbnQpID0+XG4gICAgICAgICAgQF9zaG93U2lnbmF0dXJlT3ZlcmxheShldmVudCwgQClcblxuICAgICAgaWYgbm90IGF0b20uY29uZmlnLmdldCgnYXV0b2NvbXBsZXRlLXBsdXMuZW5hYmxlQXV0b0FjdGl2YXRpb24nKVxuICAgICAgICBsb2cuZGVidWcgJ0lnbm9yaW5nIGtleXVwIGV2ZW50cyBkdWUgdG8gYXV0b2NvbXBsZXRlLXBsdXMgc2V0dGluZ3MuJ1xuICAgICAgICByZXR1cm5cbiAgICAgIGRpc3Bvc2FibGUgPSBAX2FkZEV2ZW50TGlzdGVuZXIgZWRpdG9yLCBldmVudE5hbWUsIChlKSA9PlxuICAgICAgICBpZiBhdG9tLmtleW1hcHMua2V5c3Ryb2tlRm9yS2V5Ym9hcmRFdmVudChlKSA9PSAnXignXG4gICAgICAgICAgbG9nLmRlYnVnICdUcnlpbmcgdG8gY29tcGxldGUgYXJndW1lbnRzIG9uIGtleXVwIGV2ZW50JywgZVxuICAgICAgICAgIEBfY29tcGxldGVBcmd1bWVudHMoZWRpdG9yLCBlZGl0b3IuZ2V0Q3Vyc29yQnVmZmVyUG9zaXRpb24oKSlcbiAgICAgIEBkaXNwb3NhYmxlcy5hZGQgZGlzcG9zYWJsZVxuICAgICAgQHN1YnNjcmlwdGlvbnNbZXZlbnRJZF0gPSBkaXNwb3NhYmxlXG4gICAgICBsb2cuZGVidWcgJ1N1YnNjcmliZWQgb24gZXZlbnQnLCBldmVudElkXG4gICAgZWxzZVxuICAgICAgaWYgZXZlbnRJZCBvZiBAc3Vic2NyaXB0aW9uc1xuICAgICAgICBAc3Vic2NyaXB0aW9uc1tldmVudElkXS5kaXNwb3NlKClcbiAgICAgICAgbG9nLmRlYnVnICdVbnN1YnNjcmliZWQgZnJvbSBldmVudCcsIGV2ZW50SWRcblxuICBfc2VyaWFsaXplOiAocmVxdWVzdCkgLT5cbiAgICBsb2cuZGVidWcgJ1NlcmlhbGl6aW5nIHJlcXVlc3QgdG8gYmUgc2VudCB0byBKZWRpJywgcmVxdWVzdFxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KVxuXG4gIF9zZW5kUmVxdWVzdDogKGRhdGEsIHJlc3Bhd25lZCkgLT5cbiAgICBsb2cuZGVidWcgJ1BlbmRpbmcgcmVxdWVzdHM6JywgT2JqZWN0LmtleXMoQHJlcXVlc3RzKS5sZW5ndGgsIEByZXF1ZXN0c1xuICAgIGlmIE9iamVjdC5rZXlzKEByZXF1ZXN0cykubGVuZ3RoID4gMTBcbiAgICAgIGxvZy5kZWJ1ZyAnQ2xlYW5pbmcgdXAgcmVxdWVzdCBxdWV1ZSB0byBhdm9pZCBvdmVyZmxvdywgaWdub3JpbmcgcmVxdWVzdCdcbiAgICAgIEByZXF1ZXN0cyA9IHt9XG4gICAgICBpZiBAcHJvdmlkZXIgYW5kIEBwcm92aWRlci5wcm9jZXNzXG4gICAgICAgIGxvZy5kZWJ1ZyAnS2lsbGluZyBweXRob24gcHJvY2VzcydcbiAgICAgICAgQHByb3ZpZGVyLmtpbGwoKVxuICAgICAgICByZXR1cm5cblxuICAgIGlmIEBwcm92aWRlciBhbmQgQHByb3ZpZGVyLnByb2Nlc3NcbiAgICAgIHByb2Nlc3MgPSBAcHJvdmlkZXIucHJvY2Vzc1xuICAgICAgaWYgcHJvY2Vzcy5leGl0Q29kZSA9PSBudWxsIGFuZCBwcm9jZXNzLnNpZ25hbENvZGUgPT0gbnVsbFxuICAgICAgICBpZiBAcHJvdmlkZXIucHJvY2Vzcy5waWRcbiAgICAgICAgICByZXR1cm4gQHByb3ZpZGVyLnByb2Nlc3Muc3RkaW4ud3JpdGUoZGF0YSArICdcXG4nKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbG9nLmRlYnVnICdBdHRlbXB0IHRvIGNvbW11bmljYXRlIHdpdGggdGVybWluYXRlZCBwcm9jZXNzJywgQHByb3ZpZGVyXG4gICAgICBlbHNlIGlmIHJlc3Bhd25lZFxuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICAgICBbXCJGYWlsZWQgdG8gc3Bhd24gZGFlbW9uIGZvciBhdXRvY29tcGxldGUtcHl0aG9uLlwiXG4gICAgICAgICAgIFwiQ29tcGxldGlvbnMgd2lsbCBub3Qgd29yayBhbnltb3JlXCJcbiAgICAgICAgICAgXCJ1bmxlc3MgeW91IHJlc3RhcnQgeW91ciBlZGl0b3IuXCJdLmpvaW4oJyAnKSwge1xuICAgICAgICAgIGRldGFpbDogW1wiZXhpdENvZGU6ICN7cHJvY2Vzcy5leGl0Q29kZX1cIlxuICAgICAgICAgICAgICAgICAgIFwic2lnbmFsQ29kZTogI3twcm9jZXNzLnNpZ25hbENvZGV9XCJdLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlfSlcbiAgICAgICAgQGRpc3Bvc2UoKVxuICAgICAgZWxzZVxuICAgICAgICBAX3NwYXduRGFlbW9uKClcbiAgICAgICAgQF9zZW5kUmVxdWVzdChkYXRhLCByZXNwYXduZWQ6IHRydWUpXG4gICAgICAgIGxvZy5kZWJ1ZyAnUmUtc3Bhd25pbmcgcHl0aG9uIHByb2Nlc3MuLi4nXG4gICAgZWxzZVxuICAgICAgbG9nLmRlYnVnICdTcGF3bmluZyBweXRob24gcHJvY2Vzcy4uLidcbiAgICAgIEBfc3Bhd25EYWVtb24oKVxuICAgICAgQF9zZW5kUmVxdWVzdChkYXRhKVxuXG4gIF9kZXNlcmlhbGl6ZTogKHJlc3BvbnNlKSAtPlxuICAgIGxvZy5kZWJ1ZyAnRGVzZXJlYWxpemluZyByZXNwb25zZSBmcm9tIEplZGknLCByZXNwb25zZVxuICAgIGxvZy5kZWJ1ZyBcIkdvdCAje3Jlc3BvbnNlLnRyaW0oKS5zcGxpdCgnXFxuJykubGVuZ3RofSBsaW5lc1wiXG4gICAgZm9yIHJlc3BvbnNlU291cmNlIGluIHJlc3BvbnNlLnRyaW0oKS5zcGxpdCgnXFxuJylcbiAgICAgIHRyeVxuICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UocmVzcG9uc2VTb3VyY2UpXG4gICAgICBjYXRjaCBlXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlwiXCJGYWlsZWQgdG8gcGFyc2UgSlNPTiBmcm9tIFxcXCIje3Jlc3BvbnNlU291cmNlfVxcXCIuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBPcmlnaW5hbCBleGNlcHRpb246ICN7ZX1cIlwiXCIpXG5cbiAgICAgIGlmIHJlc3BvbnNlWydhcmd1bWVudHMnXVxuICAgICAgICBlZGl0b3IgPSBAcmVxdWVzdHNbcmVzcG9uc2VbJ2lkJ11dXG4gICAgICAgIGlmIHR5cGVvZiBlZGl0b3IgPT0gJ29iamVjdCdcbiAgICAgICAgICBidWZmZXJQb3NpdGlvbiA9IGVkaXRvci5nZXRDdXJzb3JCdWZmZXJQb3NpdGlvbigpXG4gICAgICAgICAgIyBDb21wYXJlIHJlc3BvbnNlIElEIHdpdGggY3VycmVudCBzdGF0ZSB0byBhdm9pZCBzdGFsZSBjb21wbGV0aW9uc1xuICAgICAgICAgIGlmIHJlc3BvbnNlWydpZCddID09IEBfZ2VuZXJhdGVSZXF1ZXN0SWQoJ2FyZ3VtZW50cycsIGVkaXRvciwgYnVmZmVyUG9zaXRpb24pXG4gICAgICAgICAgICBAc25pcHBldHNNYW5hZ2VyPy5pbnNlcnRTbmlwcGV0KHJlc3BvbnNlWydhcmd1bWVudHMnXSwgZWRpdG9yKVxuICAgICAgZWxzZVxuICAgICAgICByZXNvbHZlID0gQHJlcXVlc3RzW3Jlc3BvbnNlWydpZCddXVxuICAgICAgICBpZiB0eXBlb2YgcmVzb2x2ZSA9PSAnZnVuY3Rpb24nXG4gICAgICAgICAgcmVzb2x2ZShyZXNwb25zZVsncmVzdWx0cyddKVxuICAgICAgY2FjaGVTaXplRGVsdGEgPSBPYmplY3Qua2V5cyhAcmVzcG9uc2VzKS5sZW5ndGggPiBAY2FjaGVTaXplXG4gICAgICBpZiBjYWNoZVNpemVEZWx0YSA+IDBcbiAgICAgICAgaWRzID0gT2JqZWN0LmtleXMoQHJlc3BvbnNlcykuc29ydCAoYSwgYikgPT5cbiAgICAgICAgICByZXR1cm4gQHJlc3BvbnNlc1thXVsndGltZXN0YW1wJ10gLSBAcmVzcG9uc2VzW2JdWyd0aW1lc3RhbXAnXVxuICAgICAgICBmb3IgaWQgaW4gaWRzLnNsaWNlKDAsIGNhY2hlU2l6ZURlbHRhKVxuICAgICAgICAgIGxvZy5kZWJ1ZyAnUmVtb3Zpbmcgb2xkIGl0ZW0gZnJvbSBjYWNoZSB3aXRoIElEJywgaWRcbiAgICAgICAgICBkZWxldGUgQHJlc3BvbnNlc1tpZF1cbiAgICAgIEByZXNwb25zZXNbcmVzcG9uc2VbJ2lkJ11dID1cbiAgICAgICAgc291cmNlOiByZXNwb25zZVNvdXJjZVxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgIGxvZy5kZWJ1ZyAnQ2FjaGVkIHJlcXVlc3Qgd2l0aCBJRCcsIHJlc3BvbnNlWydpZCddXG4gICAgICBkZWxldGUgQHJlcXVlc3RzW3Jlc3BvbnNlWydpZCddXVxuXG4gIF9nZW5lcmF0ZVJlcXVlc3RJZDogKHR5cGUsIGVkaXRvciwgYnVmZmVyUG9zaXRpb24sIHRleHQpIC0+XG4gICAgaWYgbm90IHRleHRcbiAgICAgIHRleHQgPSBlZGl0b3IuZ2V0VGV4dCgpXG4gICAgcmV0dXJuIHJlcXVpcmUoJ2NyeXB0bycpLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShbXG4gICAgICBlZGl0b3IuZ2V0UGF0aCgpLCB0ZXh0LCBidWZmZXJQb3NpdGlvbi5yb3csXG4gICAgICBidWZmZXJQb3NpdGlvbi5jb2x1bW4sIHR5cGVdLmpvaW4oKSkuZGlnZXN0KCdoZXgnKVxuXG4gIF9nZW5lcmF0ZVJlcXVlc3RDb25maWc6IC0+XG4gICAgZXh0cmFQYXRocyA9IEBJbnRlcnByZXRlckxvb2t1cC5hcHBseVN1YnN0aXR1dGlvbnMoXG4gICAgICBhdG9tLmNvbmZpZy5nZXQoJ2F1dG9jb21wbGV0ZS1weXRob24uZXh0cmFQYXRocycpLnNwbGl0KCc7JykpXG4gICAgYXJncyA9XG4gICAgICAnZXh0cmFQYXRocyc6IGV4dHJhUGF0aHNcbiAgICAgICd1c2VTbmlwcGV0cyc6IGF0b20uY29uZmlnLmdldCgnYXV0b2NvbXBsZXRlLXB5dGhvbi51c2VTbmlwcGV0cycpXG4gICAgICAnY2FzZUluc2Vuc2l0aXZlQ29tcGxldGlvbic6IGF0b20uY29uZmlnLmdldChcbiAgICAgICAgJ2F1dG9jb21wbGV0ZS1weXRob24uY2FzZUluc2Vuc2l0aXZlQ29tcGxldGlvbicpXG4gICAgICAnc2hvd0Rlc2NyaXB0aW9ucyc6IGF0b20uY29uZmlnLmdldChcbiAgICAgICAgJ2F1dG9jb21wbGV0ZS1weXRob24uc2hvd0Rlc2NyaXB0aW9ucycpXG4gICAgICAnZnV6enlNYXRjaGVyJzogYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLmZ1enp5TWF0Y2hlcicpXG4gICAgcmV0dXJuIGFyZ3NcblxuICBzZXRTbmlwcGV0c01hbmFnZXI6IChAc25pcHBldHNNYW5hZ2VyKSAtPlxuXG4gIF9jb21wbGV0ZUFyZ3VtZW50czogKGVkaXRvciwgYnVmZmVyUG9zaXRpb24sIGZvcmNlKSAtPlxuICAgIHVzZVNuaXBwZXRzID0gYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLnVzZVNuaXBwZXRzJylcbiAgICBpZiBub3QgZm9yY2UgYW5kIHVzZVNuaXBwZXRzID09ICdub25lJ1xuICAgICAgYXRvbS5jb21tYW5kcy5kaXNwYXRjaChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhdG9tLXRleHQtZWRpdG9yJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhdXRvY29tcGxldGUtcGx1czphY3RpdmF0ZScpXG4gICAgICByZXR1cm5cbiAgICBzY29wZURlc2NyaXB0b3IgPSBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24oYnVmZmVyUG9zaXRpb24pXG4gICAgc2NvcGVDaGFpbiA9IHNjb3BlRGVzY3JpcHRvci5nZXRTY29wZUNoYWluKClcbiAgICBkaXNhYmxlRm9yU2VsZWN0b3IgPSBAU2VsZWN0b3IuY3JlYXRlKEBkaXNhYmxlRm9yU2VsZWN0b3IpXG4gICAgaWYgQHNlbGVjdG9yc01hdGNoU2NvcGVDaGFpbihkaXNhYmxlRm9yU2VsZWN0b3IsIHNjb3BlQ2hhaW4pXG4gICAgICBsb2cuZGVidWcgJ0lnbm9yaW5nIGFyZ3VtZW50IGNvbXBsZXRpb24gaW5zaWRlIG9mJywgc2NvcGVDaGFpblxuICAgICAgcmV0dXJuXG5cbiAgICAjIHdlIGRvbid0IHdhbnQgdG8gY29tcGxldGUgYXJndW1lbnRzIGluc2lkZSBvZiBleGlzdGluZyBjb2RlXG4gICAgbGluZXMgPSBlZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0TGluZXMoKVxuICAgIGxpbmUgPSBsaW5lc1tidWZmZXJQb3NpdGlvbi5yb3ddXG4gICAgcHJlZml4ID0gbGluZS5zbGljZShidWZmZXJQb3NpdGlvbi5jb2x1bW4gLSAxLCBidWZmZXJQb3NpdGlvbi5jb2x1bW4pXG4gICAgaWYgcHJlZml4IGlzbnQgJygnXG4gICAgICBsb2cuZGVidWcgJ0lnbm9yaW5nIGFyZ3VtZW50IGNvbXBsZXRpb24gd2l0aCBwcmVmaXgnLCBwcmVmaXhcbiAgICAgIHJldHVyblxuICAgIHN1ZmZpeCA9IGxpbmUuc2xpY2UgYnVmZmVyUG9zaXRpb24uY29sdW1uLCBsaW5lLmxlbmd0aFxuICAgIGlmIG5vdCAvXihcXCkoPzokfFxccyl8XFxzfCQpLy50ZXN0KHN1ZmZpeClcbiAgICAgIGxvZy5kZWJ1ZyAnSWdub3JpbmcgYXJndW1lbnQgY29tcGxldGlvbiB3aXRoIHN1ZmZpeCcsIHN1ZmZpeFxuICAgICAgcmV0dXJuXG5cbiAgICBwYXlsb2FkID1cbiAgICAgIGlkOiBAX2dlbmVyYXRlUmVxdWVzdElkKCdhcmd1bWVudHMnLCBlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKVxuICAgICAgbG9va3VwOiAnYXJndW1lbnRzJ1xuICAgICAgcGF0aDogZWRpdG9yLmdldFBhdGgoKVxuICAgICAgc291cmNlOiBlZGl0b3IuZ2V0VGV4dCgpXG4gICAgICBsaW5lOiBidWZmZXJQb3NpdGlvbi5yb3dcbiAgICAgIGNvbHVtbjogYnVmZmVyUG9zaXRpb24uY29sdW1uXG4gICAgICBjb25maWc6IEBfZ2VuZXJhdGVSZXF1ZXN0Q29uZmlnKClcblxuICAgIEBfc2VuZFJlcXVlc3QoQF9zZXJpYWxpemUocGF5bG9hZCkpXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlID0+XG4gICAgICBAcmVxdWVzdHNbcGF5bG9hZC5pZF0gPSBlZGl0b3JcblxuICBfZnV6enlGaWx0ZXI6IChjYW5kaWRhdGVzLCBxdWVyeSkgLT5cbiAgICBpZiBjYW5kaWRhdGVzLmxlbmd0aCBpc250IDAgYW5kIHF1ZXJ5IG5vdCBpbiBbJyAnLCAnLicsICcoJ11cbiAgICAgIGNhbmRpZGF0ZXMgPSBAZmlsdGVyKGNhbmRpZGF0ZXMsIHF1ZXJ5LCBrZXk6ICd0ZXh0JylcbiAgICByZXR1cm4gY2FuZGlkYXRlc1xuXG4gIGdldFN1Z2dlc3Rpb25zOiAoe2VkaXRvciwgYnVmZmVyUG9zaXRpb24sIHNjb3BlRGVzY3JpcHRvciwgcHJlZml4fSkgLT5cbiAgICBAbG9hZCgpXG4gICAgaWYgbm90IEB0cmlnZ2VyQ29tcGxldGlvblJlZ2V4LnRlc3QocHJlZml4KVxuICAgICAgcmV0dXJuIEBsYXN0U3VnZ2VzdGlvbnMgPSBbXVxuICAgIGJ1ZmZlclBvc2l0aW9uID1cbiAgICAgIHJvdzogYnVmZmVyUG9zaXRpb24ucm93XG4gICAgICBjb2x1bW46IGJ1ZmZlclBvc2l0aW9uLmNvbHVtblxuICAgIGxpbmVzID0gZWRpdG9yLmdldEJ1ZmZlcigpLmdldExpbmVzKClcbiAgICBpZiBhdG9tLmNvbmZpZy5nZXQoJ2F1dG9jb21wbGV0ZS1weXRob24uZnV6enlNYXRjaGVyJylcbiAgICAgICMgd2Ugd2FudCB0byBkbyBvdXIgb3duIGZpbHRlcmluZywgaGlkZSBhbnkgZXhpc3Rpbmcgc3VmZml4IGZyb20gSmVkaVxuICAgICAgbGluZSA9IGxpbmVzW2J1ZmZlclBvc2l0aW9uLnJvd11cbiAgICAgIGxhc3RJZGVudGlmaWVyID0gL1xcLj9bYS16QS1aX11bYS16QS1aMC05X10qJC8uZXhlYyhcbiAgICAgICAgbGluZS5zbGljZSAwLCBidWZmZXJQb3NpdGlvbi5jb2x1bW4pXG4gICAgICBpZiBsYXN0SWRlbnRpZmllclxuICAgICAgICBidWZmZXJQb3NpdGlvbi5jb2x1bW4gPSBsYXN0SWRlbnRpZmllci5pbmRleCArIDFcbiAgICAgICAgbGluZXNbYnVmZmVyUG9zaXRpb24ucm93XSA9IGxpbmUuc2xpY2UoMCwgYnVmZmVyUG9zaXRpb24uY29sdW1uKVxuICAgIHJlcXVlc3RJZCA9IEBfZ2VuZXJhdGVSZXF1ZXN0SWQoXG4gICAgICAnY29tcGxldGlvbnMnLCBlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uLCBsaW5lcy5qb2luKCdcXG4nKSlcbiAgICBpZiByZXF1ZXN0SWQgb2YgQHJlc3BvbnNlc1xuICAgICAgbG9nLmRlYnVnICdVc2luZyBjYWNoZWQgcmVzcG9uc2Ugd2l0aCBJRCcsIHJlcXVlc3RJZFxuICAgICAgIyBXZSBoYXZlIHRvIHBhcnNlIEpTT04gb24gZWFjaCByZXF1ZXN0IGhlcmUgdG8gcGFzcyBvbmx5IGEgY29weVxuICAgICAgbWF0Y2hlcyA9IEpTT04ucGFyc2UoQHJlc3BvbnNlc1tyZXF1ZXN0SWRdWydzb3VyY2UnXSlbJ3Jlc3VsdHMnXVxuICAgICAgaWYgYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLmZ1enp5TWF0Y2hlcicpXG4gICAgICAgIHJldHVybiBAbGFzdFN1Z2dlc3Rpb25zID0gQF9mdXp6eUZpbHRlcihtYXRjaGVzLCBwcmVmaXgpXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBAbGFzdFN1Z2dlc3Rpb25zID0gbWF0Y2hlc1xuICAgIHBheWxvYWQgPVxuICAgICAgaWQ6IHJlcXVlc3RJZFxuICAgICAgcHJlZml4OiBwcmVmaXhcbiAgICAgIGxvb2t1cDogJ2NvbXBsZXRpb25zJ1xuICAgICAgcGF0aDogZWRpdG9yLmdldFBhdGgoKVxuICAgICAgc291cmNlOiBlZGl0b3IuZ2V0VGV4dCgpXG4gICAgICBsaW5lOiBidWZmZXJQb3NpdGlvbi5yb3dcbiAgICAgIGNvbHVtbjogYnVmZmVyUG9zaXRpb24uY29sdW1uXG4gICAgICBjb25maWc6IEBfZ2VuZXJhdGVSZXF1ZXN0Q29uZmlnKClcblxuICAgIEBfc2VuZFJlcXVlc3QoQF9zZXJpYWxpemUocGF5bG9hZCkpXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlIChyZXNvbHZlKSA9PlxuICAgICAgaWYgYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLmZ1enp5TWF0Y2hlcicpXG4gICAgICAgIEByZXF1ZXN0c1twYXlsb2FkLmlkXSA9IChtYXRjaGVzKSA9PlxuICAgICAgICAgIHJlc29sdmUoQGxhc3RTdWdnZXN0aW9ucyA9IEBfZnV6enlGaWx0ZXIobWF0Y2hlcywgcHJlZml4KSlcbiAgICAgIGVsc2VcbiAgICAgICAgQHJlcXVlc3RzW3BheWxvYWQuaWRdID0gKHN1Z2dlc3Rpb25zKSA9PlxuICAgICAgICAgIHJlc29sdmUoQGxhc3RTdWdnZXN0aW9ucyA9IHN1Z2dlc3Rpb25zKVxuXG4gIGdldERlZmluaXRpb25zOiAoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikgLT5cbiAgICBwYXlsb2FkID1cbiAgICAgIGlkOiBAX2dlbmVyYXRlUmVxdWVzdElkKCdkZWZpbml0aW9ucycsIGVkaXRvciwgYnVmZmVyUG9zaXRpb24pXG4gICAgICBsb29rdXA6ICdkZWZpbml0aW9ucydcbiAgICAgIHBhdGg6IGVkaXRvci5nZXRQYXRoKClcbiAgICAgIHNvdXJjZTogZWRpdG9yLmdldFRleHQoKVxuICAgICAgbGluZTogYnVmZmVyUG9zaXRpb24ucm93XG4gICAgICBjb2x1bW46IGJ1ZmZlclBvc2l0aW9uLmNvbHVtblxuICAgICAgY29uZmlnOiBAX2dlbmVyYXRlUmVxdWVzdENvbmZpZygpXG5cbiAgICBAX3NlbmRSZXF1ZXN0KEBfc2VyaWFsaXplKHBheWxvYWQpKVxuICAgIHJldHVybiBuZXcgUHJvbWlzZSAocmVzb2x2ZSkgPT5cbiAgICAgIEByZXF1ZXN0c1twYXlsb2FkLmlkXSA9IHJlc29sdmVcblxuICBnZXRVc2FnZXM6IChlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKSAtPlxuICAgIHBheWxvYWQgPVxuICAgICAgaWQ6IEBfZ2VuZXJhdGVSZXF1ZXN0SWQoJ3VzYWdlcycsIGVkaXRvciwgYnVmZmVyUG9zaXRpb24pXG4gICAgICBsb29rdXA6ICd1c2FnZXMnXG4gICAgICBwYXRoOiBlZGl0b3IuZ2V0UGF0aCgpXG4gICAgICBzb3VyY2U6IGVkaXRvci5nZXRUZXh0KClcbiAgICAgIGxpbmU6IGJ1ZmZlclBvc2l0aW9uLnJvd1xuICAgICAgY29sdW1uOiBidWZmZXJQb3NpdGlvbi5jb2x1bW5cbiAgICAgIGNvbmZpZzogQF9nZW5lcmF0ZVJlcXVlc3RDb25maWcoKVxuXG4gICAgQF9zZW5kUmVxdWVzdChAX3NlcmlhbGl6ZShwYXlsb2FkKSlcbiAgICByZXR1cm4gbmV3IFByb21pc2UgKHJlc29sdmUpID0+XG4gICAgICBAcmVxdWVzdHNbcGF5bG9hZC5pZF0gPSByZXNvbHZlXG5cbiAgZ2V0TWV0aG9kczogKGVkaXRvciwgYnVmZmVyUG9zaXRpb24pIC0+XG4gICAgaW5kZW50ID0gYnVmZmVyUG9zaXRpb24uY29sdW1uXG4gICAgbGluZXMgPSBlZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0TGluZXMoKVxuICAgIGxpbmVzLnNwbGljZShidWZmZXJQb3NpdGlvbi5yb3cgKyAxLCAwLCBcIiAgZGVmIF9fYXV0b2NvbXBsZXRlX3B5dGhvbihzKTpcIilcbiAgICBsaW5lcy5zcGxpY2UoYnVmZmVyUG9zaXRpb24ucm93ICsgMiwgMCwgXCIgICAgcy5cIilcbiAgICBwYXlsb2FkID1cbiAgICAgIGlkOiBAX2dlbmVyYXRlUmVxdWVzdElkKCdtZXRob2RzJywgZWRpdG9yLCBidWZmZXJQb3NpdGlvbilcbiAgICAgIGxvb2t1cDogJ21ldGhvZHMnXG4gICAgICBwYXRoOiBlZGl0b3IuZ2V0UGF0aCgpXG4gICAgICBzb3VyY2U6IGxpbmVzLmpvaW4oJ1xcbicpXG4gICAgICBsaW5lOiBidWZmZXJQb3NpdGlvbi5yb3cgKyAyXG4gICAgICBjb2x1bW46IDZcbiAgICAgIGNvbmZpZzogQF9nZW5lcmF0ZVJlcXVlc3RDb25maWcoKVxuXG4gICAgQF9zZW5kUmVxdWVzdChAX3NlcmlhbGl6ZShwYXlsb2FkKSlcbiAgICByZXR1cm4gbmV3IFByb21pc2UgKHJlc29sdmUpID0+XG4gICAgICBAcmVxdWVzdHNbcGF5bG9hZC5pZF0gPSAobWV0aG9kcykgLT5cbiAgICAgICAgcmVzb2x2ZSh7bWV0aG9kcywgaW5kZW50LCBidWZmZXJQb3NpdGlvbn0pXG5cbiAgZ29Ub0RlZmluaXRpb246IChlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKSAtPlxuICAgIGlmIG5vdCBlZGl0b3JcbiAgICAgIGVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuICAgIGlmIG5vdCBidWZmZXJQb3NpdGlvblxuICAgICAgYnVmZmVyUG9zaXRpb24gPSBlZGl0b3IuZ2V0Q3Vyc29yQnVmZmVyUG9zaXRpb24oKVxuICAgIGlmIEBkZWZpbml0aW9uc1ZpZXdcbiAgICAgIEBkZWZpbml0aW9uc1ZpZXcuZGVzdHJveSgpXG4gICAgQGRlZmluaXRpb25zVmlldyA9IG5ldyBARGVmaW5pdGlvbnNWaWV3KClcbiAgICBAZ2V0RGVmaW5pdGlvbnMoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikudGhlbiAocmVzdWx0cykgPT5cbiAgICAgIEBkZWZpbml0aW9uc1ZpZXcuc2V0SXRlbXMocmVzdWx0cylcbiAgICAgIGlmIHJlc3VsdHMubGVuZ3RoID09IDFcbiAgICAgICAgQGRlZmluaXRpb25zVmlldy5jb25maXJtZWQocmVzdWx0c1swXSlcblxuICBkaXNwb3NlOiAtPlxuICAgIGlmIEBkaXNwb3NhYmxlc1xuICAgICAgQGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIGlmIEBwcm92aWRlclxuICAgICAgQHByb3ZpZGVyLmtpbGwoKVxuIl19
