(function() {
  module.exports = {
    priority: 1,
    providerName: 'autocomplete-python',
    disableForSelector: '.source.python .comment, .source.python .string, .source.python .numeric, .source.python .integer, .source.python .decimal, .source.python .punctuation, .source.python .keyword, .source.python .storage, .source.python .variable.parameter, .source.python .entity.name',
    constructed: false,
    constructor: function() {
      this.provider = require('./provider');
      this.log = require('./log');
      this.selectorsMatchScopeChain = require('./scope-helpers').selectorsMatchScopeChain;
      this.Selector = require('selector-kit').Selector;
      this.constructed = true;
      return this.log.debug('Loading python hyper-click provider...');
    },
    _getScopes: function(editor, range) {
      return editor.scopeDescriptorForBufferPosition(range).scopes;
    },
    getSuggestionForWord: function(editor, text, range) {
      var bufferPosition, callback, disableForSelector, scopeChain, scopeDescriptor;
      if (!this.constructed) {
        this.constructor();
      }
      if (text === '.' || text === ':') {
        return;
      }
      if (editor.getGrammar().scopeName.indexOf('source.python') > -1) {
        bufferPosition = range.start;
        scopeDescriptor = editor.scopeDescriptorForBufferPosition(bufferPosition);
        scopeChain = scopeDescriptor.getScopeChain();
        disableForSelector = this.Selector.create(this.disableForSelector);
        if (this.selectorsMatchScopeChain(disableForSelector, scopeChain)) {
          return;
        }
        if (atom.config.get('autocomplete-python.outputDebug')) {
          this.log.debug(range.start, this._getScopes(editor, range.start));
          this.log.debug(range.end, this._getScopes(editor, range.end));
        }
        callback = (function(_this) {
          return function() {
            return _this.provider.load().goToDefinition(editor, bufferPosition);
          };
        })(this);
        return {
          range: range,
          callback: callback
        };
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3BwaW91cy8uYXRvbS9wYWNrYWdlcy9hdXRvY29tcGxldGUtcHl0aG9uL2xpYi9oeXBlcmNsaWNrLXByb3ZpZGVyLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtFQUFBLE1BQU0sQ0FBQyxPQUFQLEdBQ0U7SUFBQSxRQUFBLEVBQVUsQ0FBVjtJQUNBLFlBQUEsRUFBYyxxQkFEZDtJQUVBLGtCQUFBLEVBQW9CLDRRQUZwQjtJQUdBLFdBQUEsRUFBYSxLQUhiO0lBS0EsV0FBQSxFQUFhLFNBQUE7TUFDWCxJQUFDLENBQUEsUUFBRCxHQUFZLE9BQUEsQ0FBUSxZQUFSO01BQ1osSUFBQyxDQUFBLEdBQUQsR0FBTyxPQUFBLENBQVEsT0FBUjtNQUNOLElBQUMsQ0FBQSwyQkFBNEIsT0FBQSxDQUFRLGlCQUFSLEVBQTVCO01BQ0QsSUFBQyxDQUFBLFdBQVksT0FBQSxDQUFRLGNBQVIsRUFBWjtNQUNGLElBQUMsQ0FBQSxXQUFELEdBQWU7YUFDZixJQUFDLENBQUEsR0FBRyxDQUFDLEtBQUwsQ0FBVyx3Q0FBWDtJQU5XLENBTGI7SUFhQSxVQUFBLEVBQVksU0FBQyxNQUFELEVBQVMsS0FBVDtBQUNWLGFBQU8sTUFBTSxDQUFDLGdDQUFQLENBQXdDLEtBQXhDLENBQThDLENBQUM7SUFENUMsQ0FiWjtJQWdCQSxvQkFBQSxFQUFzQixTQUFDLE1BQUQsRUFBUyxJQUFULEVBQWUsS0FBZjtBQUNwQixVQUFBO01BQUEsSUFBRyxDQUFJLElBQUMsQ0FBQSxXQUFSO1FBQ0UsSUFBQyxDQUFBLFdBQUQsQ0FBQSxFQURGOztNQUVBLElBQUcsSUFBQSxLQUFTLEdBQVQsSUFBQSxJQUFBLEtBQWMsR0FBakI7QUFDRSxlQURGOztNQUVBLElBQUcsTUFBTSxDQUFDLFVBQVAsQ0FBQSxDQUFtQixDQUFDLFNBQVMsQ0FBQyxPQUE5QixDQUFzQyxlQUF0QyxDQUFBLEdBQXlELENBQUMsQ0FBN0Q7UUFDRSxjQUFBLEdBQWlCLEtBQUssQ0FBQztRQUN2QixlQUFBLEdBQWtCLE1BQU0sQ0FBQyxnQ0FBUCxDQUNoQixjQURnQjtRQUVsQixVQUFBLEdBQWEsZUFBZSxDQUFDLGFBQWhCLENBQUE7UUFDYixrQkFBQSxHQUFxQixJQUFDLENBQUEsUUFBUSxDQUFDLE1BQVYsQ0FBaUIsSUFBQyxDQUFBLGtCQUFsQjtRQUNyQixJQUFHLElBQUMsQ0FBQSx3QkFBRCxDQUEwQixrQkFBMUIsRUFBOEMsVUFBOUMsQ0FBSDtBQUNFLGlCQURGOztRQUdBLElBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFaLENBQWdCLGlDQUFoQixDQUFIO1VBQ0UsSUFBQyxDQUFBLEdBQUcsQ0FBQyxLQUFMLENBQVcsS0FBSyxDQUFDLEtBQWpCLEVBQXdCLElBQUMsQ0FBQSxVQUFELENBQVksTUFBWixFQUFvQixLQUFLLENBQUMsS0FBMUIsQ0FBeEI7VUFDQSxJQUFDLENBQUEsR0FBRyxDQUFDLEtBQUwsQ0FBVyxLQUFLLENBQUMsR0FBakIsRUFBc0IsSUFBQyxDQUFBLFVBQUQsQ0FBWSxNQUFaLEVBQW9CLEtBQUssQ0FBQyxHQUExQixDQUF0QixFQUZGOztRQUdBLFFBQUEsR0FBVyxDQUFBLFNBQUEsS0FBQTtpQkFBQSxTQUFBO21CQUNULEtBQUMsQ0FBQSxRQUFRLENBQUMsSUFBVixDQUFBLENBQWdCLENBQUMsY0FBakIsQ0FBZ0MsTUFBaEMsRUFBd0MsY0FBeEM7VUFEUztRQUFBLENBQUEsQ0FBQSxDQUFBLElBQUE7QUFFWCxlQUFPO1VBQUMsT0FBQSxLQUFEO1VBQVEsVUFBQSxRQUFSO1VBZFQ7O0lBTG9CLENBaEJ0Qjs7QUFERiIsInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZS5leHBvcnRzID1cbiAgcHJpb3JpdHk6IDFcbiAgcHJvdmlkZXJOYW1lOiAnYXV0b2NvbXBsZXRlLXB5dGhvbidcbiAgZGlzYWJsZUZvclNlbGVjdG9yOiAnLnNvdXJjZS5weXRob24gLmNvbW1lbnQsIC5zb3VyY2UucHl0aG9uIC5zdHJpbmcsIC5zb3VyY2UucHl0aG9uIC5udW1lcmljLCAuc291cmNlLnB5dGhvbiAuaW50ZWdlciwgLnNvdXJjZS5weXRob24gLmRlY2ltYWwsIC5zb3VyY2UucHl0aG9uIC5wdW5jdHVhdGlvbiwgLnNvdXJjZS5weXRob24gLmtleXdvcmQsIC5zb3VyY2UucHl0aG9uIC5zdG9yYWdlLCAuc291cmNlLnB5dGhvbiAudmFyaWFibGUucGFyYW1ldGVyLCAuc291cmNlLnB5dGhvbiAuZW50aXR5Lm5hbWUnXG4gIGNvbnN0cnVjdGVkOiBmYWxzZVxuXG4gIGNvbnN0cnVjdG9yOiAtPlxuICAgIEBwcm92aWRlciA9IHJlcXVpcmUgJy4vcHJvdmlkZXInXG4gICAgQGxvZyA9IHJlcXVpcmUgJy4vbG9nJ1xuICAgIHtAc2VsZWN0b3JzTWF0Y2hTY29wZUNoYWlufSA9IHJlcXVpcmUgJy4vc2NvcGUtaGVscGVycydcbiAgICB7QFNlbGVjdG9yfSA9IHJlcXVpcmUgJ3NlbGVjdG9yLWtpdCdcbiAgICBAY29uc3RydWN0ZWQgPSB0cnVlXG4gICAgQGxvZy5kZWJ1ZyAnTG9hZGluZyBweXRob24gaHlwZXItY2xpY2sgcHJvdmlkZXIuLi4nXG5cbiAgX2dldFNjb3BlczogKGVkaXRvciwgcmFuZ2UpIC0+XG4gICAgcmV0dXJuIGVkaXRvci5zY29wZURlc2NyaXB0b3JGb3JCdWZmZXJQb3NpdGlvbihyYW5nZSkuc2NvcGVzXG5cbiAgZ2V0U3VnZ2VzdGlvbkZvcldvcmQ6IChlZGl0b3IsIHRleHQsIHJhbmdlKSAtPlxuICAgIGlmIG5vdCBAY29uc3RydWN0ZWRcbiAgICAgIEBjb25zdHJ1Y3RvcigpXG4gICAgaWYgdGV4dCBpbiBbJy4nLCAnOiddXG4gICAgICByZXR1cm5cbiAgICBpZiBlZGl0b3IuZ2V0R3JhbW1hcigpLnNjb3BlTmFtZS5pbmRleE9mKCdzb3VyY2UucHl0aG9uJykgPiAtMVxuICAgICAgYnVmZmVyUG9zaXRpb24gPSByYW5nZS5zdGFydFxuICAgICAgc2NvcGVEZXNjcmlwdG9yID0gZWRpdG9yLnNjb3BlRGVzY3JpcHRvckZvckJ1ZmZlclBvc2l0aW9uKFxuICAgICAgICBidWZmZXJQb3NpdGlvbilcbiAgICAgIHNjb3BlQ2hhaW4gPSBzY29wZURlc2NyaXB0b3IuZ2V0U2NvcGVDaGFpbigpXG4gICAgICBkaXNhYmxlRm9yU2VsZWN0b3IgPSBAU2VsZWN0b3IuY3JlYXRlKEBkaXNhYmxlRm9yU2VsZWN0b3IpXG4gICAgICBpZiBAc2VsZWN0b3JzTWF0Y2hTY29wZUNoYWluKGRpc2FibGVGb3JTZWxlY3Rvciwgc2NvcGVDaGFpbilcbiAgICAgICAgcmV0dXJuXG5cbiAgICAgIGlmIGF0b20uY29uZmlnLmdldCgnYXV0b2NvbXBsZXRlLXB5dGhvbi5vdXRwdXREZWJ1ZycpXG4gICAgICAgIEBsb2cuZGVidWcgcmFuZ2Uuc3RhcnQsIEBfZ2V0U2NvcGVzKGVkaXRvciwgcmFuZ2Uuc3RhcnQpXG4gICAgICAgIEBsb2cuZGVidWcgcmFuZ2UuZW5kLCBAX2dldFNjb3BlcyhlZGl0b3IsIHJhbmdlLmVuZClcbiAgICAgIGNhbGxiYWNrID0gPT5cbiAgICAgICAgQHByb3ZpZGVyLmxvYWQoKS5nb1RvRGVmaW5pdGlvbihlZGl0b3IsIGJ1ZmZlclBvc2l0aW9uKVxuICAgICAgcmV0dXJuIHtyYW5nZSwgY2FsbGJhY2t9XG4iXX0=
