/*jshint -W030 */
'use strict'; // So this file can be used as a stand-alone node module
/*jshint +W030 */

// All operators, sorted by precedence level
var operatorLevels = [{
    key: [':'],
    field: ['.'],
    deg: ['°'],
    take: ['_'],
}, {
    rassoc: true,
    pow: ['^'],
    sqrt: ['√'],
}, {
    mul: [
        '*',
        '\u2062', // invisible times
        '\u22c5', // ⋅ dot operator
        '\u00b7', // · middle dot
    ],
    cross: ['×'],
    div: [
        '/',
        '\u00f7', // ÷ division sign
        '\u2215', // ∕ division slash
        '\u2236', // ∶ ratio
    ],
}, {
    add: ['+'],
    sub: ['-', '−'],
    neg: ['!', '¬'],
}, {
    seq: ['..'],
}, {
    eq: ['==', '≟'],
    ne: ['!=', '<>', '≠'],
    lt: ['<'],
    gt: ['>'],
    le: ['<=', '≤', '≦'],
    ge: ['>=', '≥', '≧'],
    aeq: ['~=', '≈'],
    ane: ['~!=', '≉'],
    alt: ['~<', '⪉'],
    agt: ['~>', '⪊'],
    ale: ['~<=', '⪅'],
    age: ['~>=', '⪆'],
    'in': ['∈'],
    nin: ['∉'],
}, {
    and: ['&', '∧'],
    or: ['%', '∨'],
}, {
    rassoc: true,
    prepend: ['<:'],
}, {
    concat: ['++', '∪'],
    remove: ['--', '∖'],
    common: ['~~', '∩'],
    append: [':>'],
}, {
    rassoc: true,
    assign: ['='],
    define: [':='],
    undefine: [':=_'],
    bdefine: ['::='],
}, {
    seq: [';'],
}, {
    modif: ['->', '→'],
}, {
    rassoc: true,
    list: [','],
}];

var prefixOperators = ['+', '-'];
var prefixOnly = ['!', '√'];
var postfixOnly = ['°', ':=_'];
var flexfix = [';', ','];

var operatorSymbols = [];
var operators = {};

(function initializeOperators() {
    var precedence = 0;
    operatorLevels.forEach(function(level) {
        precedence += 2;
        var rassoc = !!level.rassoc;
        for (var name in level) {
            var symbols = level[name];
            if (typeof symbols === 'boolean')
                continue;
            var descr = {
                name: name,
                sym: symbols[0],
                symbols: symbols,
                rassoc: rassoc,
                precedence: precedence,
                prefix: false,
                postfix: false,
                infix: true,
                bare: false,
            };
            for (var i = 0; i < symbols.length; ++i) {
                var symbol = symbols[i];
                if (operators.hasOwnProperty(symbol))
                    throw Error('Duplicate operator: ' + symbol);
                operators[symbol] = descr;
                operatorSymbols.push(symbol);
            }
        }
    });
    prefixOperators.forEach(function(op) {
        operators[op].prefix = true;
    });
    prefixOnly.forEach(function(op) {
        operators[op].prefix = true;
        operators[op].infix = false;
    });
    postfixOnly.forEach(function(op) {
        operators[op].postfix = true;
        operators[op].infix = false;
    });
    flexfix.forEach(function(op) {
        operators[op].prefix = true;
        operators[op].postfix = true;
        operators[op].infix = true;
        operators[op].bare = true;
    });
})();

operatorSymbols.sort(function(a, b) {
    return b.length - a.length;
});

var brackets = '[](){}||';

var inTokenWhitespace = '[ \t]*';
var whitespaceToken = '[ \t\n]+';

// Allow spaces in tokens. Any occurrence of ' ' is replaced by '[…]*',
// with […] matching the class of allowed in-token whitespace.
function expandSpaces(str) {
    return str.replace(/ /g, inTokenWhitespace);
}

// Quote special characters in strings so they can be used in regular
// expressions without triggering any special meaning
function rescape(str) {
    return str.replace(/[^A-Za-z0-9 \u0080-\uffff]/ig, '\\$&');
}

// Form a group consisting matching any of the given strings literally,
// but with whitespace allowed.
function anyOfGroup(lst) {
    return '(' + lst.map(rescape).join('|') + ')';
}

// Either an integer part, possibly followed by a possibly empty
// fractional part, possibly followed by an exponent, or a leading dot
// followed by a non-empty fractional part, possibly followed by an
// exponent.
var reNumber = expandSpaces(
    '(?:[0-9](?: [0-9])*(?: \\.(?! \\.)(?: [0-9])*)?|\\.(?: [0-9])+)' +
    '(?: [Ee](?: [+-])?(?: [0-9])+)?'
);

var supDigit = '[⁰¹²³⁴⁵⁶⁷⁸⁹]';
var subDigit = '[₀₁₂₃₄₅₆₇₈₉]';
var supNum = expandSpaces('(?:[⁺⁻] )?' + supDigit + '(?: ' + supDigit + ')*');
var subNum = expandSpaces('(?:[₊₋] )?' + subDigit + '(?: ' + subDigit + ')*');

// Letters (Unicode 8.0.0 category L), or rather their UTF-16 encoding
// (using surrogate pairs as needed). Generated by tools/unicodeCat.js.
// See Parser_test.js for an uncompressed version of this string.
var unicodeLetters = (function(dict, str, hiRanges) {
    var i, fst;
    var j = 0;
    var res = "(?:[";
    var n = str.length;
    for (i = 0; i < n; ++i) {
        var code = str.charCodeAt(i);
        if (code >= 0xd800) {
            res += "]|" + str.charAt(i) + "[";
            j = 0xdc00;
        } else {
            res += String.fromCharCode(fst = j = dict[code - 32] + j);
            j += dict[str.charCodeAt(++i) - 32];
            if (j !== fst) {
                if (j !== fst + 1) res += "-";
                res += String.fromCharCode(j);
            }
        }
    }
    return res + "]|[" + hiRanges + "][\udc00-\udfff])";
})([
    2, 0, 106, 3, 4, 1, 6, 5, 7, 11, 17, 8, 12, 21, 9, 22, 30, 10, 15, 24, 25,
    16, 13, 42, 46, 14, 18, 19, 29, 37, 27, 28, 35, 26, 32, 36, 40, 43, 47, 53,
    20, 48, 50, 56, 33, 34, 39, 51, 52, 55, 63, 64, 65, 68, 85, 23, 31, 38, 45,
    49, 105, 59, 66, 69, 72, 88, 102, 114, 117, 128, 157, 191, 41, 44, 54, 60,
    67, 70, 71, 73, 74, 75, 76, 80, 81, 82, 83, 84, 86, 87, 89, 93, 94, 98, 99,
    107, 108, 116, 122, 130, 132, 134, 138, 160, 165, 185, 195, 196, 255, 268,
    277, 310, 332, 339, 362, 365, 390, 449, 457, 470, 512, 513, 541, 568, 582,
    619, 673, 726, 768, 820, 921, 991, 1164, 2684, 6581, 8453, 11171, 20949
], ("T4(4I!)!'!&/ 0 \x96')2$+! !\x83$ %## !(!   ! ; u \x86.\x88 =#!+YoA& 87C" +
    "% } !5%+%) #!*! <0a,!4B1%'!&-'!1!$!33`HsG$!;!+.52'(#%#- & !$#$!*!9%  2%" +
    "H''%#- & % % %B# !H *+   - & % $$!;!5%3!,(#%#- & % $$!X%  5!:! '$  #$% " +
    "! %$%$ $)W!G(   / 2$!> &%C(   / . $$!L! %5%;(   D#!*!* 4'&*$W + !#&]F %" +
    "6&]% !#% !#!(# &   ! !#% # %1!#$ !/#L!S( @?$\x817-!*''#$!$%+ ',6!:= !&!" +
    "#7 \x90 ##& ! ##D ##B ##& ! ##9 K ##^Y2*V#'$\x9d#5 4&p((+, #2*2*2,  5OC" +
    "!'!Uy.D !&_)0J<#$,E'4Q/1Pv!|8:&K<9%)E>@7 )@\x80# #$%1gT\x8e#'#=#'#( ! !" +
    " ! 0#P & !$  &$##'',&  &d!9!*,b!'!#. !$$(! ! ! # 1##&$'!G%\xa58 8 \x84(" +
    "#$%6= !&!#Q+!*/1& & & & & & & &t!\x97%E$&%'V(  z #&D${:Aj2\x99\xa6q\xa9" +
    "E\xa4UZ#\x8d$2)%-8*0#_J+#b#M#(S1   # /0O2[R'$! !6>)/A?+8<!*$ .)$ D3  (-" +
    "/$!$[ !$%#$#! !4 #1+ 6'#'#'1& & 7 .)c0\xa86/'I\xa7\x93#\\N&6$&! . , $ !" +
    " % % \x7fM\x92;R#Gh)d$ \x85=4(4,a$'#'#'# \ud800!) 4 : % 9#6@\x82\x94?$I" +
    "IX*5 ((=)<#@'(\ud801!f~N.Of\x8f1-)(\ud802!'#! E %$!#/)/10^: %)-)4nQ(%T!" +
    "5#   AZ?$?C( >?G)-):9*\ud803!`KJ9J\ud804#PriL3>@7M$!6F2#/! !C* 3V& ! # " +
    "9 .+8N(#%#- & % $$!;!6$\ud805eF-% !\x8987#=F-!k7x4\ud806\x87RB!\x95K" +
    "\ud808!\xa2\ud809e\x8a\ud80d!8\ud811!\x9c\ud81a!\x9b+0c<;F*#BH&:\ud81b" +
    "\xa0U,!l,\ud82c!%\ud82f!\"&,$++.\ud835!w m %#!#%## ) ! & S ##( & > # $ " +
    "!$& \x91#3 3 0 3 0 3 0 3 0 3 (\ud83a!\x8b\ud83b\x98# A % !#! . # ! !(!'" +
    "! ! !   % !#! ! ! ! ! % !## & # # ! . 5&  $ 5\ud869!\x9f7\x8c\ud86d!" +
    "\xa1,g\ud86e!<#\xa3\ud873!\x9e\ud87e!\x9a"
), "\ud80c\ud840-\ud868\ud86a-\ud86c\ud86f-\ud872");

var reIdentifier = expandSpaces(
    "#(?: [1-9])?|(?:'|" + unicodeLetters + ")(?: (?:[0-9']|" + unicodeLetters + "))*"
);

var reNextToken = [ //                 token text
    '(' + whitespaceToken + ')', //    whitespace
    '(//.*)', //                       single-line comment
    '(/\\*)', //                       start of multi-line comment
    '(' + reNumber + ')', //           number literal
    anyOfGroup(operatorSymbols), //    operator
    anyOfGroup(brackets.split('')), // bracket
    '(' + subNum + ')', //             subscript
    '(' + supNum + ')', //             superscript
    '(' + reIdentifier + ')', //       identifier
    '("[^"]*")', //                    string literal
    '($)', //                          EOF
].join('|');

var reSpace = new RegExp(inTokenWhitespace.replace(/\*$/, '+'), 'g');

var tokenTypes = [
    'ANY', 'WS', 'COMMENT', 'START_COMMENT',
    'NUM', 'OP', 'BRA', 'SUB', 'SUP', 'ID', 'STR', 'EOF'
];

(function sanityCheck() {
    var re = new RegExp(reNextToken, 'g');
    var match = re.exec('');
    if (match.hasOwnProperty(tokenTypes.length))
        throw Error('RE has more groups than expected');
    if (!match.hasOwnProperty(tokenTypes.length - 1))
        throw Error('RE has fewer groups than expected');
})();

function ParseError(message, location, text) {
    var msg = message;
    if (location)
        msg = msg + ' at ' + location.row + ':' + location.col;
    if (text)
        msg = msg + ': ‘' + text + '’';
    var err = Error(msg);
    err.name = 'CindyScriptParseError';
    err.description = message;
    err.location = location;
    err.text = text;
    return err;
}

function Tokenizer(input) {
    this.input = input;
    this.re = new RegExp(reNextToken, 'g');
    var bols = []; // beginnings of lines
    var pos = input.indexOf('\n') + 1;
    while (pos) {
        bols.push(pos);
        pos = input.indexOf('\n', pos) + 1;
    }
    bols.push(input.length);
    this.bols = bols;
    this.pos = 0;
    this.bol = 0;
    this.line = 1;
}

Tokenizer.prototype.advanceBy = function(offset) {
    this.advanceTo(this.pos + offset);
};

Tokenizer.prototype.advanceTo = function(pos) {
    this.pos = pos;
    while (this.bols[0] <= pos) {
        this.bol = this.bols.shift();
        this.line++;
    }
};

Tokenizer.prototype.curPos = function() {
    return {
        row: this.line,
        col: this.pos - this.bol,
        pos: this.pos
    };
};

Tokenizer.prototype.nextInternal = function() {
    var match = this.re.exec(this.input);
    if (match.index !== this.pos)
        throw ParseError('Invalid token', this.curPos(),
            this.input.substring(this.pos, match.index));
    var pos1 = this.curPos();
    this.advanceBy(match[0].length);
    var pos2 = this.curPos();
    var tt;
    /*jshint -W116 */
    for (tt = 1; match[tt] == null; ++tt) {} // neither null nor undefined
    /*jshint +W116 */
    return {
        start: pos1,
        end: pos2,
        raw: match[0],
        text: match[0].replace(reSpace, ''),
        toktype: tokenTypes[tt]
    };
};

Tokenizer.prototype.next = function() {
    var tok;
    do {
        tok = this.nextInternal();
        if (tok.toktype === 'START_COMMENT') {
            // Match multiline comment, take nesting into account
            var reComment = /\*\/|\/\*/g;
            reComment.lastIndex = tok.start.pos + 2;
            var depth = 1;
            var match;
            while (depth > 0) {
                match = reComment.exec(this.input);
                if (!match) {
                    throw ParseError('Unterminated comment',
                        tok.start, tok.text);
                } else if (match[0] === '/*') {
                    ++depth;
                } else {
                    --depth;
                }
            }
            this.re.lastIndex = reComment.lastIndex;
            this.advanceTo(reComment.lastIndex);
            tok.end = this.curPos();
            tok.raw = this.input.substring(tok.start.pos, tok.end.pos);
            tok.text = tok.raw;
            tok.toktype = 'COMMENT';
        }
    } while (tok.toktype === 'WS' || tok.toktype === 'COMMENT');
    return tok;
};

// Take a sequence ending in […, ‹lhs›, ‹op›, ‹rhs›] and turn it into
// […, ‹op›], but record ‹lhs› and ‹rhs› as args of ‹op›.
function applyOperator(seq) {
    var op = seq[seq.length - 2];
    var lhs = seq[seq.length - 3];
    var rhs = seq[seq.length - 1];
    if (lhs) {
        if (lhs.isSuperscript && op.precedence <= lhs.precedence)
            throw ParseError(
                'Operator not allowed after superscript',
                op.start, op.text);
        if (rhs) { // expr op expr
            if (!op.op.infix)
                throw ParseError(
                    'Operator may not be used infix',
                    op.start, op.text);
        } else { // expr op null
            if (!op.op.postfix)
                throw ParseError(
                    'Operator may not be used postfix',
                    op.start, op.text);
        }
    } else {
        if (rhs) { // null op expr
            if (!op.op.prefix)
                throw ParseError(
                    'Operator may not be used prefix',
                    op.start, op.text);
        } else {
            if (!op.op.bare)
                throw ParseError(
                    'Operator without operands',
                    op.start, op.text);
        }
    }
    op.ctype = 'infix';
    op.oper = op.op.sym;
    op.args = [lhs, rhs];
    seq.splice(seq.length - 3, 3, op);
}

function subsup(seq, tok, op, dict) {
    if (!(seq.length & 1)) seq.push(null);
    op = operators[op];
    while (seq.length >= 3 &&
        seq[seq.length - 2].precedence <= op.precedence)
        applyOperator(seq);
    seq.push({
        op: op,
        precedence: op.precedence + (op.rassoc ? 1 : 0),
        start: tok.start,
        end: tok.end,
        text: tok.text,
        rawtext: tok.rawtext
    });
    var dstDigits = "";
    var srcDigits = tok.text;
    for (var i = 0; i < srcDigits.length; ++i)
        dstDigits += "0123456789+-".charAt(dict.indexOf(srcDigits.charAt(i)));
    tok.ctype = 'number';
    tok.value = {
        real: +dstDigits,
        imag: 0
    };
    seq.push(tok);
    applyOperator(seq);
}

// Recursively called for nested brackets. closing is the text of the
// expected closing bracket, which will be treated as closing even if
// it also is an opening bracket, e.g. in the case of |…|.
function parseRec(tokens, closing) {
    // Seq is an alternating list of expressions (even indices) and
    // incomplete operators (odd indices). The order of operator
    // precedences is by increasing value, since if the precedence
    // value were to decrease, previous operators can be applied.
    // In the case of right-associative operators, multiple operators
    // in the sequence can have equal precedence.
    var seq = [];
    var tok; // last token to be processed
    parseLoop: while (true) {
        tok = tokens.next();
        switch (tok.toktype) {
            case 'OP':
                var op = operators[tok.text];
                if (op.sym === '_' &&
                    seq.length && !(seq.length & 1) && // preceding op
                    seq[seq.length - 1].toktype === 'OP' && // 
                    seq[seq.length - 1].op.sym === ':=') {
                    seq.pop();
                    op = operators[':=_'];
                    tok.text = op.sym;
                }
                tok.op = op;
                tok.precedence = op.precedence;
                if (!(seq.length & 1)) seq.push(null);
                while (seq.length >= 3 &&
                    seq[seq.length - 2].precedence <= tok.precedence)
                    applyOperator(seq);
                if (op.rassoc)
                    tok.precedence++;
                seq.push(tok);
                break;
            case 'ID':
                tok.ctype = 'variable';
                tok.name = tok.text;
                if (seq.length & 1)
                    throw ParseError('Missing operator', tok.start, tok.text);
                seq.push(tok);
                break;
            case 'NUM':
                tok.ctype = 'number';
                tok.value = {
                    real: +tok.text,
                    imag: 0
                };
                if (seq.length & 1)
                    throw ParseError('Missing operator', tok.start, tok.text);
                seq.push(tok);
                break;
            case 'STR':
                tok.ctype = 'string';
                tok.value = tok.raw.substring(1, tok.raw.length - 1);
                if (seq.length & 1)
                    throw ParseError('Missing operator', tok.start, tok.text);
                seq.push(tok);
                break;
            case 'SUB':
                subsup(seq, tok, '_', '₀₁₂₃₄₅₆₇₈₉₊₋');
                break;
            case 'SUP':
                subsup(seq, tok, '^', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻');
                seq[seq.length - 1].isSuperscript = true;
                break;
            case 'BRA':
                var bra = brackets.indexOf(tok.text);
                if (tok.text === closing || bra & 1)
                    break parseLoop;
                var closer = brackets.charAt(bra + 1);
                var sub = parseRec(tokens, closer);
                var ctok = sub.closedBy;
                if (ctok.text !== closer)
                    throw ParseError(
                        'Opening ' + tok.text +
                        ' at ' + tok.start.row + ':' + tok.start.col +
                        ' closed by ' + (ctok.text || 'EOF') +
                        ' at ' + ctok.start.row + ':' + ctok.start.col);
                var pair = tok.text + ctok.text;
                var lst = [];
                var expr = sub.expr;
                if (expr) {
                    while (expr && expr.ctype === 'infix' && expr.oper === ',') {
                        lst.push(expr.args[0]);
                        expr = expr.args[1];
                    }
                    lst.push(expr);
                }
                if (!(seq.length & 1)) { // value position
                    if (pair === '||') {
                        if (lst.length === 1) {
                            seq.push({
                                ctype: 'function',
                                oper: 'abs_infix',
                                args: lst,
                                modifs: {},
                            });
                        } else if (lst.length === 2) {
                            seq.push({
                                ctype: 'function',
                                oper: 'dist_infix',
                                args: lst,
                                modifs: {},
                            });
                        } else {
                            throw ParseError(
                                "Don't support |…| with " + lst.length +
                                ' arguments', tok.start);
                        }
                    } else if (pair === '{}') {
                        throw ParseError('{…} reserved for future use', tok.start);
                    } else if (pair !== '[]' && lst.length === 1) {
                        seq.push({
                            ctype: 'paren',
                            args: lst,
                        });
                    } else if (lst.length === 0) {
                        seq.push({
                            ctype: 'list',
                            value: [],
                        });
                    } else {
                        seq.push({
                            ctype: 'function',
                            oper: 'genList',
                            args: lst,
                            modifs: {},
                        });
                    }
                } else { // operator position, so it's a function call
                    if (pair === '{}')
                        throw ParseError('{…} reserved for future use', tok.start);
                    var fname = seq[seq.length - 1];
                    if (fname.ctype !== 'variable')
                        throw ParseError(
                            'Function name must be an identifier',
                            fname.start);
                    fname.ctype = 'function';
                    var args = fname.args = [];
                    var modifs = fname.modifs = {};
                    for (var i = 0; i < lst.length; ++i) {
                        var elt = lst[i];
                        if (elt && elt.ctype === 'infix' && elt.oper === '->') {
                            var id = elt.args[0];
                            if (id.ctype !== 'variable')
                                throw ParseError(
                                    'Modifier name must be an identifier',
                                    elt.start);
                            modifs[id.name] = elt.args[1];
                        } else {
                            args.push(elt);
                        }
                    }
                    fname.oper = fname.name + '$' + fname.args.length;
                }
                break;
            case 'EOF':
                break parseLoop;
        }
    }
    if (!(seq.length & 1)) seq.push(null);
    while (seq.length >= 3)
        applyOperator(seq);
    return {
        expr: seq[0],
        closedBy: tok
    };
}

var cvoid = {
    ctype: 'void'
};

function Parser(expr) {
    this.usedFunctions = {};
    this.usedVariables = {};
}

Parser.prototype.postprocess = function(expr) {
    if (expr === null)
        return cvoid;
    if (expr) {
        // parent-first postprocessing
        if (expr.ctype === 'infix') {
            if (expr.oper === ':=') {
                var fun = expr.args[0];
                if (fun.ctype === 'function') {
                    fun.args.forEach(function(arg) {
                        if (arg === null || arg.ctype !== 'variable')
                            throw ParseError(
                                'Function argument must be an identifier',
                                arg.start || expr.start);
                    });
                } else if (fun.ctype !== 'variable') {
                    throw ParseError(
                        expr.oper + ' can only be used to define ' +
                        'functions or variables',
                        expr.start);
                }
            } else if (expr.oper === ',') {
                throw ParseError(
                    'comma may only be used to delimit list elements',
                    expr.start);
            }
        }

        if (expr.args)
            expr.args = expr.args.map(this.postprocess, this);
        if (expr.modifs)
            for (var key in expr.modifs)
                expr.modifs[key] = this.postprocess(expr.modifs[key]);

        // parent-last postprocessing
        if (expr.ctype === 'paren') {
            return expr.args[0];
        } else if (expr.ctype === 'infix') {
            if (expr.oper === '.') {
                if (!(expr.args[1] && expr.args[1].ctype === 'variable'))
                    throw ParseError(
                        'Field name must be identifier', expr.start, expr.text);
                expr.ctype = 'field';
                expr.obj = expr.args[0];
                expr.key = expr.args[1].name;
            }
            if (this.infixmap)
                expr.impl = this.infixmap[expr.oper];
        } else if (expr.ctype === 'variable') {
            this.usedVariables[expr.name] = true;
        } else if (expr.ctype === 'function') {
            this.usedFunctions[expr.oper] = true;
        }
    }
    if (expr && typeof expr === 'object') {
        delete expr.start;
        delete expr.end;
        delete expr.toktype;
        delete expr.op;
        delete expr.raw;
        delete expr.text;
    }
    return expr;
};

Parser.prototype.parse = function(code) {
    try {
        var res = parseRec(new Tokenizer(code));
        if (res.closedBy.toktype !== 'EOF')
            throw ParseError(
                'Closing bracket never opened.',
                res.closedBy.start,
                res.closedBy.text
            );
        return this.postprocess(res.expr);
    } catch (err) {
        err.ctype = 'error';
        return err;
    }
};

if (typeof process !== "undefined" &&
    typeof module !== "undefined" &&
    typeof module.exports !== "undefined" &&
    typeof window === "undefined") {
    module.exports.Parser = Parser;
    module.exports.Tokenizer = Tokenizer;
    module.exports.unicodeLetters = unicodeLetters;
    module.exports.parse = function(code) {
        return (new Parser()).parse(code);
    };
}
