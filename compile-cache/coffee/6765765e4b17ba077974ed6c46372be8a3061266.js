(function() {
  var log, touchbar;

  log = require('./log');

  if (atom.config.get('autocomplete-python.enableTouchBar')) {
    touchbar = require('./touchbar');
  }

  module.exports = {
    _showSignatureOverlay: function(event) {
      var cursor, disableForSelector, editor, getTooltip, i, len, marker, ref, scopeChain, scopeDescriptor, wordBufferRange;
      if (this.markers) {
        ref = this.markers;
        for (i = 0, len = ref.length; i < len; i++) {
          marker = ref[i];
          log.debug('destroying old marker', marker);
          marker.destroy();
        }
      } else {
        this.markers = [];
      }
      cursor = event.cursor;
      editor = event.cursor.editor;
      wordBufferRange = cursor.getCurrentWordBufferRange();
      scopeDescriptor = editor.scopeDescriptorForBufferPosition(event.newBufferPosition);
      scopeChain = scopeDescriptor.getScopeChain();
      disableForSelector = this.disableForSelector + ", .source.python .numeric, .source.python .integer, .source.python .decimal, .source.python .punctuation, .source.python .keyword, .source.python .storage, .source.python .variable.parameter, .source.python .entity.name";
      disableForSelector = this.Selector.create(disableForSelector);
      if (this.selectorsMatchScopeChain(disableForSelector, scopeChain)) {
        log.debug('do nothing for this selector');
        return;
      }
      marker = editor.markBufferRange(wordBufferRange, {
        invalidate: 'never'
      });
      this.markers.push(marker);
      getTooltip = (function(_this) {
        return function(editor, bufferPosition) {
          var payload;
          payload = {
            id: _this._generateRequestId('tooltip', editor, bufferPosition),
            lookup: 'tooltip',
            path: editor.getPath(),
            source: editor.getText(),
            line: bufferPosition.row,
            column: bufferPosition.column,
            config: _this._generateRequestConfig()
          };
          _this._sendRequest(_this._serialize(payload));
          return new Promise(function(resolve) {
            return _this.requests[payload.id] = resolve;
          });
        };
      })(this);
      return getTooltip(editor, event.newBufferPosition).then((function(_this) {
        return function(results) {
          var column, decoration, description, fileName, line, ref1, text, type, view;
          if (marker.isDestroyed()) {
            return;
          }
          if (results.length > 0) {
            ref1 = results[0], text = ref1.text, fileName = ref1.fileName, line = ref1.line, column = ref1.column, type = ref1.type, description = ref1.description;
            description = description.trim();
            if (!description) {
              return;
            }
            view = document.createElement('autocomplete-python-suggestion');
            view.appendChild(document.createTextNode(description));
            decoration = editor.decorateMarker(marker, {
              type: 'overlay',
              item: view,
              position: 'head'
            });
            if (atom.config.get('autocomplete-python.enableTouchBar')) {
              return touchbar.update(results[0]);
            }
          }
        };
      })(this));
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3BwaW91cy8uYXRvbS9wYWNrYWdlcy9hdXRvY29tcGxldGUtcHl0aG9uL2xpYi90b29sdGlwcy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBOztFQUFBLEdBQUEsR0FBTSxPQUFBLENBQVEsT0FBUjs7RUFDTixJQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBWixDQUFnQixvQ0FBaEIsQ0FBSDtJQUNFLFFBQUEsR0FBVyxPQUFBLENBQVEsWUFBUixFQURiOzs7RUFHQSxNQUFNLENBQUMsT0FBUCxHQUNBO0lBQUEscUJBQUEsRUFBdUIsU0FBQyxLQUFEO0FBQ3JCLFVBQUE7TUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFKO0FBQ0U7QUFBQSxhQUFBLHFDQUFBOztVQUNFLEdBQUcsQ0FBQyxLQUFKLENBQVUsdUJBQVYsRUFBbUMsTUFBbkM7VUFDQSxNQUFNLENBQUMsT0FBUCxDQUFBO0FBRkYsU0FERjtPQUFBLE1BQUE7UUFLRSxJQUFDLENBQUEsT0FBRCxHQUFXLEdBTGI7O01BT0EsTUFBQSxHQUFTLEtBQUssQ0FBQztNQUNmLE1BQUEsR0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDO01BQ3RCLGVBQUEsR0FBa0IsTUFBTSxDQUFDLHlCQUFQLENBQUE7TUFDbEIsZUFBQSxHQUFrQixNQUFNLENBQUMsZ0NBQVAsQ0FDaEIsS0FBSyxDQUFDLGlCQURVO01BRWxCLFVBQUEsR0FBYSxlQUFlLENBQUMsYUFBaEIsQ0FBQTtNQUViLGtCQUFBLEdBQXdCLElBQUMsQ0FBQSxrQkFBRixHQUFxQjtNQUM1QyxrQkFBQSxHQUFxQixJQUFDLENBQUEsUUFBUSxDQUFDLE1BQVYsQ0FBaUIsa0JBQWpCO01BRXJCLElBQUcsSUFBQyxDQUFBLHdCQUFELENBQTBCLGtCQUExQixFQUE4QyxVQUE5QyxDQUFIO1FBQ0UsR0FBRyxDQUFDLEtBQUosQ0FBVSw4QkFBVjtBQUNBLGVBRkY7O01BSUEsTUFBQSxHQUFTLE1BQU0sQ0FBQyxlQUFQLENBQXVCLGVBQXZCLEVBQXdDO1FBQUMsVUFBQSxFQUFZLE9BQWI7T0FBeEM7TUFFVCxJQUFDLENBQUEsT0FBTyxDQUFDLElBQVQsQ0FBYyxNQUFkO01BRUEsVUFBQSxHQUFhLENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQyxNQUFELEVBQVMsY0FBVDtBQUNYLGNBQUE7VUFBQSxPQUFBLEdBQ0U7WUFBQSxFQUFBLEVBQUksS0FBQyxDQUFBLGtCQUFELENBQW9CLFNBQXBCLEVBQStCLE1BQS9CLEVBQXVDLGNBQXZDLENBQUo7WUFDQSxNQUFBLEVBQVEsU0FEUjtZQUVBLElBQUEsRUFBTSxNQUFNLENBQUMsT0FBUCxDQUFBLENBRk47WUFHQSxNQUFBLEVBQVEsTUFBTSxDQUFDLE9BQVAsQ0FBQSxDQUhSO1lBSUEsSUFBQSxFQUFNLGNBQWMsQ0FBQyxHQUpyQjtZQUtBLE1BQUEsRUFBUSxjQUFjLENBQUMsTUFMdkI7WUFNQSxNQUFBLEVBQVEsS0FBQyxDQUFBLHNCQUFELENBQUEsQ0FOUjs7VUFPRixLQUFDLENBQUEsWUFBRCxDQUFjLEtBQUMsQ0FBQSxVQUFELENBQVksT0FBWixDQUFkO0FBQ0EsaUJBQU8sSUFBSSxPQUFKLENBQVksU0FBQyxPQUFEO21CQUNqQixLQUFDLENBQUEsUUFBUyxDQUFBLE9BQU8sQ0FBQyxFQUFSLENBQVYsR0FBd0I7VUFEUCxDQUFaO1FBVkk7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBO2FBYWIsVUFBQSxDQUFXLE1BQVgsRUFBbUIsS0FBSyxDQUFDLGlCQUF6QixDQUEyQyxDQUFDLElBQTVDLENBQWlELENBQUEsU0FBQSxLQUFBO2VBQUEsU0FBQyxPQUFEO0FBQy9DLGNBQUE7VUFBQSxJQUFHLE1BQU0sQ0FBQyxXQUFQLENBQUEsQ0FBSDtBQUNFLG1CQURGOztVQUVBLElBQUcsT0FBTyxDQUFDLE1BQVIsR0FBaUIsQ0FBcEI7WUFDRSxPQUFvRCxPQUFRLENBQUEsQ0FBQSxDQUE1RCxFQUFDLGdCQUFELEVBQU8sd0JBQVAsRUFBaUIsZ0JBQWpCLEVBQXVCLG9CQUF2QixFQUErQixnQkFBL0IsRUFBcUM7WUFFckMsV0FBQSxHQUFjLFdBQVcsQ0FBQyxJQUFaLENBQUE7WUFDZCxJQUFHLENBQUksV0FBUDtBQUNFLHFCQURGOztZQUVBLElBQUEsR0FBTyxRQUFRLENBQUMsYUFBVCxDQUF1QixnQ0FBdkI7WUFDUCxJQUFJLENBQUMsV0FBTCxDQUFpQixRQUFRLENBQUMsY0FBVCxDQUF3QixXQUF4QixDQUFqQjtZQUNBLFVBQUEsR0FBYSxNQUFNLENBQUMsY0FBUCxDQUFzQixNQUF0QixFQUE4QjtjQUN6QyxJQUFBLEVBQU0sU0FEbUM7Y0FFekMsSUFBQSxFQUFNLElBRm1DO2NBR3pDLFFBQUEsRUFBVSxNQUgrQjthQUE5QjtZQUtiLElBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFaLENBQWdCLG9DQUFoQixDQUFIO3FCQUNFLFFBQVEsQ0FBQyxNQUFULENBQWdCLE9BQVEsQ0FBQSxDQUFBLENBQXhCLEVBREY7YUFiRjs7UUFIK0M7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWpEO0lBdkNxQixDQUF2Qjs7QUFMQSIsInNvdXJjZXNDb250ZW50IjpbImxvZyA9IHJlcXVpcmUgJy4vbG9nJ1xuaWYgYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLmVuYWJsZVRvdWNoQmFyJylcbiAgdG91Y2hiYXIgPSByZXF1aXJlICcuL3RvdWNoYmFyJ1xuXG5tb2R1bGUuZXhwb3J0cyA9XG5fc2hvd1NpZ25hdHVyZU92ZXJsYXk6IChldmVudCkgLT5cbiAgaWYgQG1hcmtlcnNcbiAgICBmb3IgbWFya2VyIGluIEBtYXJrZXJzXG4gICAgICBsb2cuZGVidWcgJ2Rlc3Ryb3lpbmcgb2xkIG1hcmtlcicsIG1hcmtlclxuICAgICAgbWFya2VyLmRlc3Ryb3koKVxuICBlbHNlXG4gICAgQG1hcmtlcnMgPSBbXVxuXG4gIGN1cnNvciA9IGV2ZW50LmN1cnNvclxuICBlZGl0b3IgPSBldmVudC5jdXJzb3IuZWRpdG9yXG4gIHdvcmRCdWZmZXJSYW5nZSA9IGN1cnNvci5nZXRDdXJyZW50V29yZEJ1ZmZlclJhbmdlKClcbiAgc2NvcGVEZXNjcmlwdG9yID0gZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFxuICAgIGV2ZW50Lm5ld0J1ZmZlclBvc2l0aW9uKVxuICBzY29wZUNoYWluID0gc2NvcGVEZXNjcmlwdG9yLmdldFNjb3BlQ2hhaW4oKVxuXG4gIGRpc2FibGVGb3JTZWxlY3RvciA9IFwiI3tAZGlzYWJsZUZvclNlbGVjdG9yfSwgLnNvdXJjZS5weXRob24gLm51bWVyaWMsIC5zb3VyY2UucHl0aG9uIC5pbnRlZ2VyLCAuc291cmNlLnB5dGhvbiAuZGVjaW1hbCwgLnNvdXJjZS5weXRob24gLnB1bmN0dWF0aW9uLCAuc291cmNlLnB5dGhvbiAua2V5d29yZCwgLnNvdXJjZS5weXRob24gLnN0b3JhZ2UsIC5zb3VyY2UucHl0aG9uIC52YXJpYWJsZS5wYXJhbWV0ZXIsIC5zb3VyY2UucHl0aG9uIC5lbnRpdHkubmFtZVwiXG4gIGRpc2FibGVGb3JTZWxlY3RvciA9IEBTZWxlY3Rvci5jcmVhdGUoZGlzYWJsZUZvclNlbGVjdG9yKVxuXG4gIGlmIEBzZWxlY3RvcnNNYXRjaFNjb3BlQ2hhaW4oZGlzYWJsZUZvclNlbGVjdG9yLCBzY29wZUNoYWluKVxuICAgIGxvZy5kZWJ1ZyAnZG8gbm90aGluZyBmb3IgdGhpcyBzZWxlY3RvcidcbiAgICByZXR1cm5cblxuICBtYXJrZXIgPSBlZGl0b3IubWFya0J1ZmZlclJhbmdlKHdvcmRCdWZmZXJSYW5nZSwge2ludmFsaWRhdGU6ICduZXZlcid9KVxuXG4gIEBtYXJrZXJzLnB1c2gobWFya2VyKVxuXG4gIGdldFRvb2x0aXAgPSAoZWRpdG9yLCBidWZmZXJQb3NpdGlvbikgPT5cbiAgICBwYXlsb2FkID1cbiAgICAgIGlkOiBAX2dlbmVyYXRlUmVxdWVzdElkKCd0b29sdGlwJywgZWRpdG9yLCBidWZmZXJQb3NpdGlvbilcbiAgICAgIGxvb2t1cDogJ3Rvb2x0aXAnXG4gICAgICBwYXRoOiBlZGl0b3IuZ2V0UGF0aCgpXG4gICAgICBzb3VyY2U6IGVkaXRvci5nZXRUZXh0KClcbiAgICAgIGxpbmU6IGJ1ZmZlclBvc2l0aW9uLnJvd1xuICAgICAgY29sdW1uOiBidWZmZXJQb3NpdGlvbi5jb2x1bW5cbiAgICAgIGNvbmZpZzogQF9nZW5lcmF0ZVJlcXVlc3RDb25maWcoKVxuICAgIEBfc2VuZFJlcXVlc3QoQF9zZXJpYWxpemUocGF5bG9hZCkpXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlIChyZXNvbHZlKSA9PlxuICAgICAgQHJlcXVlc3RzW3BheWxvYWQuaWRdID0gcmVzb2x2ZVxuXG4gIGdldFRvb2x0aXAoZWRpdG9yLCBldmVudC5uZXdCdWZmZXJQb3NpdGlvbikudGhlbiAocmVzdWx0cykgPT5cbiAgICBpZiBtYXJrZXIuaXNEZXN0cm95ZWQoKVxuICAgICAgcmV0dXJuXG4gICAgaWYgcmVzdWx0cy5sZW5ndGggPiAwXG4gICAgICB7dGV4dCwgZmlsZU5hbWUsIGxpbmUsIGNvbHVtbiwgdHlwZSwgZGVzY3JpcHRpb259ID0gcmVzdWx0c1swXVxuXG4gICAgICBkZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uLnRyaW0oKVxuICAgICAgaWYgbm90IGRlc2NyaXB0aW9uXG4gICAgICAgIHJldHVyblxuICAgICAgdmlldyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2F1dG9jb21wbGV0ZS1weXRob24tc3VnZ2VzdGlvbicpXG4gICAgICB2aWV3LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGRlc2NyaXB0aW9uKSlcbiAgICAgIGRlY29yYXRpb24gPSBlZGl0b3IuZGVjb3JhdGVNYXJrZXIobWFya2VyLCB7XG4gICAgICAgIHR5cGU6ICdvdmVybGF5JyxcbiAgICAgICAgaXRlbTogdmlldyxcbiAgICAgICAgcG9zaXRpb246ICdoZWFkJ1xuICAgICAgfSlcbiAgICAgIGlmIGF0b20uY29uZmlnLmdldCgnYXV0b2NvbXBsZXRlLXB5dGhvbi5lbmFibGVUb3VjaEJhcicpXG4gICAgICAgIHRvdWNoYmFyLnVwZGF0ZShyZXN1bHRzWzBdKVxuIl19
