var Hatch = (function () {

    var run = function (code) {
        return (
            'var env = Object.create(null);\n\n' +
            polyfill +
            'return ' + compile(parse(code)) + '.value();\n'
        );
    };

    //=======
    // PARSE
    //=======

    var syntax = {
        // RegExp's for syntax.
        string: /^"([^"]*)"/,
        number: /^(\d+)\b/,
        word: /^(\w+)\b/,
        def: /^(_?\w+)\s*:/,
        prop: /^\./,
        args: /^\(/,
        argsEnd: /^\)/,
        closure: /^\{/,
        closureEnd: /^\}/,
        seq: /^,/,
        comment: /^(<<.*?>>)/
    };

    var parse = function (program) {
        return parseClosure(createClosure(), program)[0];
    };

    var parseExpr = function (rest) {
        var parseSubExpr = function (prev, rest) {
            // Continue parsing until the end of a complete expression.
            rest = skipSpace(rest);
            var expr = [];

            var matchComment = syntax.comment.exec(rest);
            var matchString = syntax.string.exec(rest);
            var matchNumber = syntax.number.exec(rest);
            var matchWord = syntax.word.exec(rest);
            var matchClosure = syntax.closure.exec(rest);
            var matchProp = syntax.prop.exec(rest);
            var matchArgs = syntax.args.exec(rest);
            var matchSeq = syntax.seq.exec(rest);

            if (matchComment) {
                // Ignore it, it's a comment.
                if (prev) { expr[0] = prev; } else { expr[0] = {}; }
                expr[1] = cutMatch(rest, matchComment);
            } else if (matchString) {
                // Match a string.
                if (prev) { return [prev, rest]; }
                expr[0] = { type: 'string', value: matchString[1] };
                expr[1] = cutMatch(rest, matchString);
            } else if (matchNumber) {
                // Match a number.
                if (prev) { return [prev, rest]; }
                expr[0] = { type: 'number', value: Number(matchNumber[1]) };
                expr[1] = cutMatch(rest, matchNumber);
            } else if (matchWord) {
                // Match a word.
                if (prev) { return [prev, rest]; }
                expr[0] = { type: 'word', value: matchWord[1] };
                expr[1] = cutMatch(rest, matchWord);
            } else if (matchClosure) {
                // Match an closure definition.
                if (prev) { return [prev, rest]; }
                expr = parseClosure(createClosure(), cutMatch(rest, matchClosure));
            } else if (matchProp) {
                // Match a property lookup.
                if (prev) {
                    var newRest = cutMatch(rest, matchProp);
                    var nextWord = syntax.word.exec(newRest);
                    if (!nextWord) {
                        throw new SyntaxError('Property is not given.');
                    }
                    expr[0] = { type: 'prop', owner: prev, prop: nextWord[1] };
                    expr[1] = cutMatch(newRest, nextWord);
                } else {
                    throw new SyntaxError('Unexpected period.');
                }
            } else if (matchArgs) {
                // Match a function call.
                if (!prev) {
                    throw new SyntaxError('Unexpected parenthesis.');
                }
                var args = parseArgs(cutMatch(rest, matchArgs));
                expr[0] = { type: 'call', caller: prev, args: args[0] };
                expr[1] = args[1];
            } else if (matchSeq) {
                // Match a sequence of expressions.
                if (!prev) {
                    throw new SyntaxError('Unexpected comma.');
                }
                var nextExpr = parseExpr(cutMatch(rest, matchSeq));
                expr[0] = { type: 'seq', expr: prev, rest: nextExpr[0] };
                expr[1] = nextExpr[1];
            } else {
                // If nothing else, return what you've got.
                return [prev, rest];
            }

            // Check to see if the next thing is a property or call.
            return parseSubExpr(expr[0], expr[1]);
        };

        return parseSubExpr(null, rest);

    };

    var parseDef = function (word, private, rest) {
        // Parse a definition block.
        rest = skipSpace(rest);
        var expr = parseExpr(rest);
        return [{ type: 'def', name: word, private: private, value: expr[0] }, expr[1] ];
    };

    var parseArgs = function (rest) {
        var parseAllArgs = function (args, rest) {
            // Continue parsing expressions until the end of the argument block.
            rest = skipSpace(rest);
            var matchArgsEnd = syntax.argsEnd.exec(rest);
            if (matchArgsEnd) {
                return [args, cutMatch(rest, matchArgsEnd)];
            } else {
                var nextArg = parseExpr(rest);
                if (!nextArg[0]) {
                    throw new SyntaxError('No end to the arguments.');
                }
                args.push(nextArg[0]);
                return parseAllArgs(args, nextArg[1]);
            }
        };

        return parseAllArgs([], rest);
    };

    var parseClosure = function (closure, rest) {
        rest = skipSpace(rest);
        if (rest === '') { return [closure, '']; }

        var matchArgs = syntax.args.exec(rest);
        var matchDef = syntax.def.exec(rest);
        var matchClosureEnd = syntax.closureEnd.exec(rest);

        if (matchArgs) {
            // Match arguments block.
            var args = parseArgs(cutMatch(rest, matchArgs));
            closure.args = args[0];
            rest = args[1];
        } else if (matchDef) {
            // Match a definition.
            var word = matchDef[1];
            var private = false;
            if(word.slice(0,1) == '_') {
                //word = word.slice(1);
                private = true;
            }
            var def = parseDef(word, private, cutMatch(rest, matchDef));
            closure.defs.push(def[0]);
            rest = def[1];
        } else if (matchClosureEnd) {
            // Match the end of an closure.
            return [closure, cutMatch(rest, matchClosureEnd)];
        } else {
            // Assume an unlabeled expression is a return value.
            var expr = parseExpr(rest);
            if (!closure.expr) {
                throw new SyntaxError('No expression given.');
            }
            if (closure.expr.type && closure.expr.type != 'nothing') {
                throw new SyntaxError('Too many expressions.');
            }
            closure.expr = expr[0];
            rest = expr[1];
        }

        return parseClosure(closure, rest);
    };

    var createClosure = function () {
        // Create a blank closure.
        return { type: 'closure', args: [], defs: [], expr: { type: 'nothing' } };
    };

    var skipSpace = function (string) {
        // Get rid of leading whitespace
        var first = string.search(/\S/);
        if (first == -1) { return ''; }
        return string.slice(first);
    };

    var cutMatch = function (string, match) {
        // Return string that starts after a regex match.
        return string.slice(match[0].length);
    };

    //===============
    // TRANSCOMPILER
    //===============

    var indent = 0;

    var compile = function (expr) {
        if (!expr.type) { throw new TypeError('Expression has no type.'); }
        return compileType[expr.type](expr);
    };

    var newLine = function (indentChange) {
        if (indentChange) { indent += indentChange; }
        var text = '\n';
        for(var i=0; i<indent; i++) { text += '  '; }
        return text;
    };

    var compileType = {
        closure: function (closure) {
            // Convert a Hatch closure to Javascript code.
            /*
            CLOSURE
            (function (env) {
                env._private = foo;
                env.public = bar;
                return {
                    public: env.public,
                    value: function (closure.args[0].value) {
                        closure.expr;
                    };
                };
            })(env);
            */
            var closureCode = '(function (env) {' + newLine(1);
            if (closure.defs) {
                closure.defs.forEach(function (def) {
                    closureCode += compile(def);
                });
            }
            closureCode += 'return {' + newLine(1);
            if (closure.defs) {
                closure.defs.forEach(function (def) {
                    if (!def.private) {
                        closureCode += def.name + ': env.' + def.name + ',' + newLine();
                    }
                });
            }
            closureCode += 'value: function (';
            if (closure.args) {
                var lastArg = closure.args[closure.args.length-1];
                closure.args.forEach(function (arg) {
                    if (!arg.value) { throw new SyntaxError('Argument has no value.'); }
                    closureCode += arg.value;
                    if (arg !== lastArg) {
                        closureCode += ', ';
                    }
                });
            }
            closureCode += ') {' + newLine(1);
            closure.args.forEach(function (arg) {
                if (!arg.value) { throw new SyntaxError('Argument has no value.'); }
                closureCode += 'env.' + arg.value + ' = function(){ return ' + arg.value + '; };' + newLine();
            });
            if (closure.expr) {
                closureCode += 'return ' + compile(closure.expr) + ';';
            } else {
                closureCode += 'return null;';
            }
            closureCode += newLine(-1) + '}' + newLine(-1) + '};' + newLine(-1) + '})(env)';
            return closureCode;
        },
        def: function (def) {
            // Convert a Hatch definition to Javascript code.
            if (!def.name) { throw new SyntaxError('Definition has no name.'); }
            if (!def.value) { throw new SyntaxError('Definition has no value.'); }
            return 'env.' + def.name + ' = function(){ return ' + compile(def.value) + '; };' + newLine();
        },
        call: function (call) {
            // Convert a Hatch function call to Javascript code.
            if (!call.caller) { throw new SyntaxError('Call has no caller.'); }
            var callCode = compile(call.caller) + '.value(';
            if (call.args) {
                var lastArg = call.args[call.args.length-1];
                call.args.forEach(function (arg) {
                    callCode += compile(arg);
                    if (arg !== lastArg) {
                        callCode += ', ';
                    }
                });
            }
            callCode += ')';
            return callCode;
        },
        prop: function (prop) {
            // Convert a Hatch property to Javascript code.
            if (!prop.owner) { throw new SyntaxError('Property has no owner.'); }
            if (!prop.prop) { throw new SyntaxError('Property has no property.'); }
            return compile(prop.owner) + '.' + prop.prop + '()';
        },
        seq: function (seq) {
            // Convert a Hatch sequence to Javascript code.
            /*
            SEQUENCE
            function () {
                expr;
                return rest;
            }();
            */
            if (!seq.expr || !seq.rest) { throw new SyntaxError('Sequence has a missing expression.'); }
            var seqCode = 'function () {' + newLine(1);
            seqCode += compile(seq.expr) + ';' + newLine();
            seqCode += 'return ' + compile(seq.rest) + ';' + newLine(-1) + '}' + newLine();
            return seqCode;
        },
        word: function (word) {
            // Convert a Hatch word to Javascript code.
            if (!word.value) { throw new SyntaxError('Word has no value.'); }
            return 'env.' + word.value + '()';
        },
        string: function (string) {
            // Convert a Hatch string to Javascript code.
            if (!string.value) { throw new SyntaxError('String has no value.'); }
            return '"' + string.value + '"';
        },
        number: function (number) {
            // Convert a Hatch number to Javascript code.
            if (!number.value) { throw new SyntaxError('Number has no value.'); }
            return number.value;
        },
        nothing: function (nothing) {
            return 'null';
        },
    };


    //===========
    // BUILT-INS
    //===========

    var makeFunction = function (args, value) {
        return 'function(){ return {value: function ' + args + ' { ' + value + ' } }; }';
    };

    var polyfill =
        '// HATCH basic commands\n' +
        'env.true = true;\n' +
        'env.false = false;\n' +
        'env.null = null;\n' +
        'env.add = ' + makeFunction('(a, b)', 'return a + b;') + ';\n' +
        'env.sub = ' + makeFunction('(a, b)', 'return a - b;') + ';\n' +
        'env.mul = ' + makeFunction('(a, b)', 'return a * b;') + ';\n' +
        'env.div = ' + makeFunction('(a, b)', 'return a / b;') + ';\n' +

        'env.eq = ' + makeFunction('(a, b)', 'if (a === b) { return env.true; } else { return env.false; }') + ';\n' +
        'env.gt = ' + makeFunction('(a, b)', 'if (a > b) { return env.true; } else { return env.false; }') + ';\n' +
        'env.lt = ' + makeFunction('(a, b)', 'if (a < b) { return env.true; } else { return env.false; }') + ';\n' +

        'env.if = ' + makeFunction('(cond, ifTrue, ifFalse)', 'if (cond === env.true) { return ifTrue; } else { return ifFalse; }') + ';\n' +

        '\n// HATCH transcompiled code\n' ;

    //========
    // EXPORT
    //========

    return {
        run: run
    };

})();
