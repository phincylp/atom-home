(function() {
  var fs, log, os, path,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  fs = require('fs');

  os = require('os');

  path = require('path');

  log = require('./log');

  module.exports = {
    pythonExecutableRe: function() {
      if (/^win/.test(process.platform)) {
        return /^python(\d+(.\d+)?)?\.exe$/;
      } else {
        return /^python(\d+(.\d+)?)?$/;
      }
    },
    possibleGlobalPythonPaths: function() {
      if (/^win/.test(process.platform)) {
        return ['C:\\Python2.7', 'C:\\Python3.4', 'C:\\Python3.5', 'C:\\Program Files (x86)\\Python 2.7', 'C:\\Program Files (x86)\\Python 3.4', 'C:\\Program Files (x86)\\Python 3.5', 'C:\\Program Files (x64)\\Python 2.7', 'C:\\Program Files (x64)\\Python 3.4', 'C:\\Program Files (x64)\\Python 3.5', 'C:\\Program Files\\Python 2.7', 'C:\\Program Files\\Python 3.4', 'C:\\Program Files\\Python 3.5', (os.homedir()) + "\\AppData\\Local\\Programs\\Python\\Python35-32"];
      } else {
        return ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
      }
    },
    readDir: function(dirPath) {
      try {
        return fs.readdirSync(dirPath);
      } catch (error) {
        return [];
      }
    },
    isBinary: function(filePath) {
      try {
        fs.accessSync(filePath, fs.X_OK);
        return true;
      } catch (error) {
        return false;
      }
    },
    lookupInterpreters: function(dirPath) {
      var f, fileName, files, interpreters, j, len, matches, potentialInterpreter;
      interpreters = new Set();
      files = this.readDir(dirPath);
      matches = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = files.length; j < len; j++) {
          f = files[j];
          if (this.pythonExecutableRe().test(f)) {
            results.push(f);
          }
        }
        return results;
      }).call(this);
      for (j = 0, len = matches.length; j < len; j++) {
        fileName = matches[j];
        potentialInterpreter = path.join(dirPath, fileName);
        if (this.isBinary(potentialInterpreter)) {
          interpreters.add(potentialInterpreter);
        }
      }
      return interpreters;
    },
    applySubstitutions: function(paths) {
      var j, k, len, len1, modPaths, p, project, projectName, ref, ref1;
      modPaths = [];
      for (j = 0, len = paths.length; j < len; j++) {
        p = paths[j];
        if (/\$PROJECT/.test(p)) {
          ref = atom.project.getPaths();
          for (k = 0, len1 = ref.length; k < len1; k++) {
            project = ref[k];
            ref1 = project.split(path.sep), projectName = ref1[ref1.length - 1];
            p = p.replace(/\$PROJECT_NAME/i, projectName);
            p = p.replace(/\$PROJECT/i, project);
            if (indexOf.call(modPaths, p) < 0) {
              modPaths.push(p);
            }
          }
        } else {
          modPaths.push(p);
        }
      }
      return modPaths;
    },
    getInterpreter: function() {
      var envPath, f, interpreters, j, k, len, len1, p, project, ref, ref1, userDefinedPythonPaths;
      userDefinedPythonPaths = this.applySubstitutions(atom.config.get('autocomplete-python.pythonPaths').split(';'));
      interpreters = new Set((function() {
        var j, len, results;
        results = [];
        for (j = 0, len = userDefinedPythonPaths.length; j < len; j++) {
          p = userDefinedPythonPaths[j];
          if (this.isBinary(p)) {
            results.push(p);
          }
        }
        return results;
      }).call(this));
      if (interpreters.size > 0) {
        log.debug('User defined interpreters found', interpreters);
        return interpreters.keys().next().value;
      }
      log.debug('No user defined interpreter found, trying automatic lookup');
      interpreters = new Set();
      ref = atom.project.getPaths();
      for (j = 0, len = ref.length; j < len; j++) {
        project = ref[j];
        ref1 = this.readDir(project);
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          f = ref1[k];
          this.lookupInterpreters(path.join(project, f, 'bin')).forEach(function(i) {
            return interpreters.add(i);
          });
        }
      }
      log.debug('Project level interpreters found', interpreters);
      envPath = (process.env.PATH || '').split(path.delimiter);
      envPath = new Set(envPath.concat(this.possibleGlobalPythonPaths()));
      envPath.forEach((function(_this) {
        return function(potentialPath) {
          return _this.lookupInterpreters(potentialPath).forEach(function(i) {
            return interpreters.add(i);
          });
        };
      })(this));
      log.debug('Total automatically found interpreters', interpreters);
      if (interpreters.size > 0) {
        return interpreters.keys().next().value;
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3BwaW91cy8uYXRvbS9wYWNrYWdlcy9hdXRvY29tcGxldGUtcHl0aG9uL2xpYi9pbnRlcnByZXRlcnMtbG9va3VwLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsaUJBQUE7SUFBQTs7RUFBQSxFQUFBLEdBQUssT0FBQSxDQUFRLElBQVI7O0VBQ0wsRUFBQSxHQUFLLE9BQUEsQ0FBUSxJQUFSOztFQUNMLElBQUEsR0FBTyxPQUFBLENBQVEsTUFBUjs7RUFDUCxHQUFBLEdBQU0sT0FBQSxDQUFRLE9BQVI7O0VBRU4sTUFBTSxDQUFDLE9BQVAsR0FDRTtJQUFBLGtCQUFBLEVBQW9CLFNBQUE7TUFDbEIsSUFBRyxNQUFNLENBQUMsSUFBUCxDQUFZLE9BQU8sQ0FBQyxRQUFwQixDQUFIO0FBQ0UsZUFBTyw2QkFEVDtPQUFBLE1BQUE7QUFHRSxlQUFPLHdCQUhUOztJQURrQixDQUFwQjtJQU1BLHlCQUFBLEVBQTJCLFNBQUE7TUFDekIsSUFBRyxNQUFNLENBQUMsSUFBUCxDQUFZLE9BQU8sQ0FBQyxRQUFwQixDQUFIO0FBQ0UsZUFBTyxDQUNMLGVBREssRUFFTCxlQUZLLEVBR0wsZUFISyxFQUlMLHFDQUpLLEVBS0wscUNBTEssRUFNTCxxQ0FOSyxFQU9MLHFDQVBLLEVBUUwscUNBUkssRUFTTCxxQ0FUSyxFQVVMLCtCQVZLLEVBV0wsK0JBWEssRUFZTCwrQkFaSyxFQWFILENBQUMsRUFBRSxDQUFDLE9BQUgsQ0FBQSxDQUFELENBQUEsR0FBYyxpREFiWCxFQURUO09BQUEsTUFBQTtBQWlCRSxlQUFPLENBQUMsZ0JBQUQsRUFBbUIsVUFBbkIsRUFBK0IsTUFBL0IsRUFBdUMsV0FBdkMsRUFBb0QsT0FBcEQsRUFqQlQ7O0lBRHlCLENBTjNCO0lBMEJBLE9BQUEsRUFBUyxTQUFDLE9BQUQ7QUFDUDtBQUNFLGVBQU8sRUFBRSxDQUFDLFdBQUgsQ0FBZSxPQUFmLEVBRFQ7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QUFJLENBQUMsU0FBcEM7TUFDVixPQUFBLEdBQVUsSUFBSSxHQUFKLENBQVEsT0FBTyxDQUFDLE1BQVIsQ0FBZSxJQUFDLENBQUEseUJBQUQsQ0FBQSxDQUFmLENBQVI7TUFDVixPQUFPLENBQUMsT0FBUixDQUFnQixDQUFBLFNBQUEsS0FBQTtlQUFBLFNBQUMsYUFBRDtpQkFDZCxLQUFDLENBQUEsa0JBQUQsQ0FBb0IsYUFBcEIsQ0FBa0MsQ0FBQyxPQUFuQyxDQUEyQyxTQUFDLENBQUQ7bUJBQ3pDLFlBQVksQ0FBQyxHQUFiLENBQWlCLENBQWpCO1VBRHlDLENBQTNDO1FBRGM7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWhCO01BR0EsR0FBRyxDQUFDLEtBQUosQ0FBVSx3Q0FBVixFQUFvRCxZQUFwRDtNQUVBLElBQUcsWUFBWSxDQUFDLElBQWIsR0FBb0IsQ0FBdkI7QUFDRSxlQUFPLFlBQVksQ0FBQyxJQUFiLENBQUEsQ0FBbUIsQ0FBQyxJQUFwQixDQUFBLENBQTBCLENBQUMsTUFEcEM7O0lBdkJjLENBL0RoQjs7QUFORiIsInNvdXJjZXNDb250ZW50IjpbImZzID0gcmVxdWlyZSAnZnMnXG5vcyA9IHJlcXVpcmUgJ29zJ1xucGF0aCA9IHJlcXVpcmUgJ3BhdGgnXG5sb2cgPSByZXF1aXJlICcuL2xvZydcblxubW9kdWxlLmV4cG9ydHMgPVxuICBweXRob25FeGVjdXRhYmxlUmU6IC0+XG4gICAgaWYgL153aW4vLnRlc3QgcHJvY2Vzcy5wbGF0Zm9ybVxuICAgICAgcmV0dXJuIC9ecHl0aG9uKFxcZCsoLlxcZCspPyk/XFwuZXhlJC9cbiAgICBlbHNlXG4gICAgICByZXR1cm4gL15weXRob24oXFxkKyguXFxkKyk/KT8kL1xuXG4gIHBvc3NpYmxlR2xvYmFsUHl0aG9uUGF0aHM6IC0+XG4gICAgaWYgL153aW4vLnRlc3QgcHJvY2Vzcy5wbGF0Zm9ybVxuICAgICAgcmV0dXJuIFtcbiAgICAgICAgJ0M6XFxcXFB5dGhvbjIuNydcbiAgICAgICAgJ0M6XFxcXFB5dGhvbjMuNCdcbiAgICAgICAgJ0M6XFxcXFB5dGhvbjMuNSdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg4NilcXFxcUHl0aG9uIDIuNydcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg4NilcXFxcUHl0aG9uIDMuNCdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg4NilcXFxcUHl0aG9uIDMuNSdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg2NClcXFxcUHl0aG9uIDIuNydcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg2NClcXFxcUHl0aG9uIDMuNCdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXMgKHg2NClcXFxcUHl0aG9uIDMuNSdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUHl0aG9uIDIuNydcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUHl0aG9uIDMuNCdcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcUHl0aG9uIDMuNSdcbiAgICAgICAgXCIje29zLmhvbWVkaXIoKX1cXFxcQXBwRGF0YVxcXFxMb2NhbFxcXFxQcm9ncmFtc1xcXFxQeXRob25cXFxcUHl0aG9uMzUtMzJcIlxuICAgICAgXVxuICAgIGVsc2VcbiAgICAgIHJldHVybiBbJy91c3IvbG9jYWwvYmluJywgJy91c3IvYmluJywgJy9iaW4nLCAnL3Vzci9zYmluJywgJy9zYmluJ11cblxuICByZWFkRGlyOiAoZGlyUGF0aCkgLT5cbiAgICB0cnlcbiAgICAgIHJldHVybiBmcy5yZWFkZGlyU3luYyBkaXJQYXRoXG4gICAgY2F0Y2hcbiAgICAgIHJldHVybiBbXVxuXG4gIGlzQmluYXJ5OiAoZmlsZVBhdGgpIC0+XG4gICAgdHJ5XG4gICAgICBmcy5hY2Nlc3NTeW5jIGZpbGVQYXRoLCBmcy5YX09LXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGNhdGNoXG4gICAgICByZXR1cm4gZmFsc2VcblxuICBsb29rdXBJbnRlcnByZXRlcnM6IChkaXJQYXRoKSAtPlxuICAgIGludGVycHJldGVycyA9IG5ldyBTZXQoKVxuICAgIGZpbGVzID0gQHJlYWREaXIoZGlyUGF0aClcbiAgICBtYXRjaGVzID0gKGYgZm9yIGYgaW4gZmlsZXMgd2hlbiBAcHl0aG9uRXhlY3V0YWJsZVJlKCkudGVzdChmKSlcbiAgICBmb3IgZmlsZU5hbWUgaW4gbWF0Y2hlc1xuICAgICAgcG90ZW50aWFsSW50ZXJwcmV0ZXIgPSBwYXRoLmpvaW4oZGlyUGF0aCwgZmlsZU5hbWUpXG4gICAgICBpZiBAaXNCaW5hcnkocG90ZW50aWFsSW50ZXJwcmV0ZXIpXG4gICAgICAgIGludGVycHJldGVycy5hZGQocG90ZW50aWFsSW50ZXJwcmV0ZXIpXG4gICAgcmV0dXJuIGludGVycHJldGVyc1xuXG4gIGFwcGx5U3Vic3RpdHV0aW9uczogKHBhdGhzKSAtPlxuICAgIG1vZFBhdGhzID0gW11cbiAgICBmb3IgcCBpbiBwYXRoc1xuICAgICAgaWYgL1xcJFBST0pFQ1QvLnRlc3QgcFxuICAgICAgICBmb3IgcHJvamVjdCBpbiBhdG9tLnByb2plY3QuZ2V0UGF0aHMoKVxuICAgICAgICAgIFsuLi4sIHByb2plY3ROYW1lXSA9IHByb2plY3Quc3BsaXQocGF0aC5zZXApXG4gICAgICAgICAgcCA9IHAucmVwbGFjZSgvXFwkUFJPSkVDVF9OQU1FL2ksIHByb2plY3ROYW1lKVxuICAgICAgICAgIHAgPSBwLnJlcGxhY2UoL1xcJFBST0pFQ1QvaSwgcHJvamVjdClcbiAgICAgICAgICBpZiBwIG5vdCBpbiBtb2RQYXRoc1xuICAgICAgICAgICAgbW9kUGF0aHMucHVzaCBwXG4gICAgICBlbHNlXG4gICAgICAgIG1vZFBhdGhzLnB1c2ggcFxuICAgIHJldHVybiBtb2RQYXRoc1xuXG4gIGdldEludGVycHJldGVyOiAtPlxuICAgIHVzZXJEZWZpbmVkUHl0aG9uUGF0aHMgPSBAYXBwbHlTdWJzdGl0dXRpb25zKFxuICAgICAgYXRvbS5jb25maWcuZ2V0KCdhdXRvY29tcGxldGUtcHl0aG9uLnB5dGhvblBhdGhzJykuc3BsaXQoJzsnKSlcbiAgICBpbnRlcnByZXRlcnMgPSBuZXcgU2V0KHAgZm9yIHAgaW4gdXNlckRlZmluZWRQeXRob25QYXRocyB3aGVuIEBpc0JpbmFyeShwKSlcbiAgICBpZiBpbnRlcnByZXRlcnMuc2l6ZSA+IDBcbiAgICAgIGxvZy5kZWJ1ZyAnVXNlciBkZWZpbmVkIGludGVycHJldGVycyBmb3VuZCcsIGludGVycHJldGVyc1xuICAgICAgcmV0dXJuIGludGVycHJldGVycy5rZXlzKCkubmV4dCgpLnZhbHVlXG5cbiAgICBsb2cuZGVidWcgJ05vIHVzZXIgZGVmaW5lZCBpbnRlcnByZXRlciBmb3VuZCwgdHJ5aW5nIGF1dG9tYXRpYyBsb29rdXAnXG4gICAgaW50ZXJwcmV0ZXJzID0gbmV3IFNldCgpXG5cbiAgICBmb3IgcHJvamVjdCBpbiBhdG9tLnByb2plY3QuZ2V0UGF0aHMoKVxuICAgICAgZm9yIGYgaW4gQHJlYWREaXIocHJvamVjdClcbiAgICAgICAgQGxvb2t1cEludGVycHJldGVycyhwYXRoLmpvaW4ocHJvamVjdCwgZiwgJ2JpbicpKS5mb3JFYWNoIChpKSAtPlxuICAgICAgICAgIGludGVycHJldGVycy5hZGQoaSlcbiAgICBsb2cuZGVidWcgJ1Byb2plY3QgbGV2ZWwgaW50ZXJwcmV0ZXJzIGZvdW5kJywgaW50ZXJwcmV0ZXJzXG4gICAgZW52UGF0aCA9IChwcm9jZXNzLmVudi5QQVRIIG9yICcnKS5zcGxpdCBwYXRoLmRlbGltaXRlclxuICAgIGVudlBhdGggPSBuZXcgU2V0KGVudlBhdGguY29uY2F0KEBwb3NzaWJsZUdsb2JhbFB5dGhvblBhdGhzKCkpKVxuICAgIGVudlBhdGguZm9yRWFjaCAocG90ZW50aWFsUGF0aCkgPT5cbiAgICAgIEBsb29rdXBJbnRlcnByZXRlcnMocG90ZW50aWFsUGF0aCkuZm9yRWFjaCAoaSkgLT5cbiAgICAgICAgaW50ZXJwcmV0ZXJzLmFkZChpKVxuICAgIGxvZy5kZWJ1ZyAnVG90YWwgYXV0b21hdGljYWxseSBmb3VuZCBpbnRlcnByZXRlcnMnLCBpbnRlcnByZXRlcnNcblxuICAgIGlmIGludGVycHJldGVycy5zaXplID4gMFxuICAgICAgcmV0dXJuIGludGVycHJldGVycy5rZXlzKCkubmV4dCgpLnZhbHVlXG4iXX0=
