'use strict';
var vscode_1 = require('vscode');
var _NL = '\n'.charCodeAt(0);
var _TAB = '\t'.charCodeAt(0);
var _WSB = ' '.charCodeAt(0);
var _LBracket = '['.charCodeAt(0);
var _RBracket = ']'.charCodeAt(0);
var _LCurly = '{'.charCodeAt(0);
var _RCurly = '}'.charCodeAt(0);
var _LParent = '('.charCodeAt(0);
var _RParent = ')'.charCodeAt(0);
var _Comma = ','.charCodeAt(0);
var _Quote = '\''.charCodeAt(0);
var _DQuote = '"'.charCodeAt(0);
var _USC = '_'.charCodeAt(0);
var _a = 'a'.charCodeAt(0);
var _z = 'z'.charCodeAt(0);
var _A = 'A'.charCodeAt(0);
var _Z = 'Z'.charCodeAt(0);
var _0 = '0'.charCodeAt(0);
var _9 = '9'.charCodeAt(0);
var BOF = 0;
var BackwardIterator = (function () {
    function BackwardIterator(model, offset, lineNumber) {
        this.lineNumber = lineNumber;
        this.offset = offset;
        this.line = model.lineAt(this.lineNumber).text;
        this.model = model;
    }
    BackwardIterator.prototype.hasNext = function () {
        return this.lineNumber >= 0;
    };
    BackwardIterator.prototype.next = function () {
        if (this.offset < 0) {
            if (this.lineNumber > 0) {
                this.lineNumber--;
                this.line = this.model.lineAt(this.lineNumber).text;
                this.offset = this.line.length - 1;
                return _NL;
            }
            this.lineNumber = -1;
            return BOF;
        }
        var ch = this.line.charCodeAt(this.offset);
        this.offset--;
        return ch;
    };
    return BackwardIterator;
})();
var PostgresqlSignatureHelpProvider = (function () {
    function PostgresqlSignatureHelpProvider() {
    }
    PostgresqlSignatureHelpProvider.prototype.provideSignatureHelp = function (document, position, token) {
        var iterator = new BackwardIterator(document, position.character - 1, position.line);
        var paramCount = this.readArguments(iterator);
        if (paramCount < 0) {
            return null;
        }
        var ident = this.readIdent(iterator);
        if (!ident) {
            return null;
        }
        var funName = ident;
        var signatureInfo = FunctionsInfoDb.GetSignatureInfo(funName);
        var ret = new vscode_1.SignatureHelp();
        ret.signatures.push(signatureInfo);
        ret.activeSignature = 0;
        ret.activeParameter = Math.min(paramCount, signatureInfo.parameters.length - 1);
        return Promise.resolve(ret);
    };
    PostgresqlSignatureHelpProvider.prototype.readArguments = function (iterator) {
        var parentNesting = 0;
        var bracketNesting = 0;
        var curlyNesting = 0;
        var paramCount = 0;
        while (iterator.hasNext()) {
            var ch = iterator.next();
            switch (ch) {
                case _LParent:
                    parentNesting--;
                    if (parentNesting < 0) {
                        return paramCount;
                    }
                    break;
                case _RParent:
                    parentNesting++;
                    break;
                case _LCurly:
                    curlyNesting--;
                    break;
                case _RCurly:
                    curlyNesting++;
                    break;
                case _LBracket:
                    bracketNesting--;
                    break;
                case _RBracket:
                    bracketNesting++;
                    break;
                case _DQuote:
                case _Quote:
                    while (iterator.hasNext() && ch !== iterator.next()) {
                    }
                    break;
                case _Comma:
                    if (!parentNesting && !bracketNesting && !curlyNesting) {
                        paramCount++;
                    }
                    break;
            }
        }
        return -1;
    };
    PostgresqlSignatureHelpProvider.prototype.isIdentPart = function (ch) {
        if (ch === _USC ||
            ch >= _a && ch <= _z ||
            ch >= _A && ch <= _Z ||
            ch >= _0 && ch <= _9 ||
            ch >= 0x80 && ch <= 0xFFFF) {
            return true;
        }
        return false;
    };
    PostgresqlSignatureHelpProvider.prototype.readIdent = function (iterator) {
        var identStarted = false;
        var ident = '';
        while (iterator.hasNext()) {
            var ch = iterator.next();
            if (!identStarted && (ch === _WSB || ch === _TAB || ch === _NL)) {
                continue;
            }
            if (this.isIdentPart(ch)) {
                identStarted = true;
                ident = String.fromCharCode(ch) + ident;
            }
            else if (identStarted) {
                return ident;
            }
        }
        return ident;
    };
    return PostgresqlSignatureHelpProvider;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostgresqlSignatureHelpProvider;
var FunctionsInfoDb = (function () {
    function FunctionsInfoDb() {
        this.funcSignatures = {};
        var rawInfo = this.GetRawInfo();
        for (var funcIdx = 0; funcIdx < rawInfo.length; funcIdx++) {
            var element = rawInfo[funcIdx];
            var lParentSplit = element[0].split("(");
            var funcName = lParentSplit[0].trim().toUpperCase();
            var signatureInfo = new vscode_1.SignatureInformation(element[0].trim(), element[1].trim());
            if (lParentSplit.length > 1) {
                var paramsList = lParentSplit[1].split(')')[0].split(",");
                for (var paramIdx = 0; paramIdx < paramsList.length; paramIdx++) {
                    signatureInfo.parameters.push({ label: paramsList[paramIdx].trim(), documentation: '' });
                }
            }
            //console.log(funcName);
            this.funcSignatures[funcName] = signatureInfo;
        }
    }
    FunctionsInfoDb.GetSignatureInfo = function (funcName) {
        if (this.mainInstance == null) {
            this.mainInstance = new FunctionsInfoDb();
        }
        return this.mainInstance.DoGetSignatureInfo(funcName.trim().toUpperCase());
    };
    FunctionsInfoDb.prototype.DoGetSignatureInfo = function (funcName) {
        return this.funcSignatures[funcName];
    };
    FunctionsInfoDb.prototype.GetRawInfo = function () {
        //documentations taken from http://www.postgresql.org/docs/9.5/static/functions.html
        return [
            ['abs(x)  RETURNS same as input', "absolute value\nE.G.: abs(-17.4)  17.4 "],
            ['cbrt(dp)  RETURNS dp', "cube root\nE.G.: cbrt(27.0)  3 "],
            ['ceil(dp or numeric)  RETURNS same as input', "smallest integer not less than argument\nE.G.: ceil(-42.8)  -42 "],
            ['ceiling(dp or numeric)  RETURNS same as input', "smallest integer not less than argument (alias for ceil)\nE.G.: ceiling(-95.3)  -95 "],
            ['degrees(dp)  RETURNS dp', "radians to degrees\nE.G.: degrees(0.5)  28.6478897565412 "],
            ['div(y numeric, x numeric)  RETURNS numeric', "integer quotient of y/x\nE.G.: div(9,4)  2 "],
            ['exp(dp or numeric)  RETURNS same as input', "exponential\nE.G.: exp(1.0)  2.71828182845905 "],
            ['floor(dp or numeric)  RETURNS same as input', "largest integer not greater than argument\nE.G.: floor(-42.8)  -43 "],
            ['ln(dp or numeric)  RETURNS same as input', "natural logarithm\nE.G.: ln(2.0)  0.693147180559945 "],
            ['log(dp or numeric)  RETURNS same as input', "base 10 logarithm\nE.G.: log(100.0)  2 "],
            ['log(b numeric, x numeric)  RETURNS numeric', "logarithm to base b\nE.G.: log(2.0, 64.0)  6 "],
            ['mod(y, x)  RETURNS same as argument types', "remainder of y/x\nE.G.: mod(9,4)  1 "],
            ['pi()  RETURNS dp', "'π' constant\nE.G.: pi()  3.14159265358979 "],
            ['power(a dp, b dp)  RETURNS dp', "a raised to the power of b\nE.G.: power(9.0, 3.0)  729 "],
            ['power(a numeric, b numeric)  RETURNS numeric', "a raised to the power of b\nE.G.: power(9.0, 3.0)  729 "],
            ['radians(dp)  RETURNS dp', "degrees to radians\nE.G.: radians(45.0)  0.785398163397448 "],
            ['round(dp or numeric)  RETURNS same as input', "round to nearest integer\nE.G.: round(42.4)  42 "],
            ['round(v numeric, s int)  RETURNS numeric', "round to s decimal places\nE.G.: round(42.4382, 2)  42.44 "],
            ['sign(dp or numeric)  RETURNS same as input', "sign of the argument (-1, 0, +1)\nE.G.: sign(-8.4)  -1 "],
            ['sqrt(dp or numeric)  RETURNS same as input', "square root\nE.G.: sqrt(2.0)  1.4142135623731 "],
            ['trunc(dp or numeric)  RETURNS same as input', "truncate toward zero\nE.G.: trunc(42.8)  42 "],
            ['trunc(v numeric, s int)  RETURNS numeric', "truncate to s decimal places\nE.G.: trunc(42.4382, 2)  42.43 "],
            ['width_bucket(operand dp, b1 dp, b2 dp, count int)  RETURNS int', "return the bucket number to which operand would be assigned in a histogram having count equal-width buckets spanning the range b1 to b2; returns 0 or count+1 for an input outside the range\nE.G.: width_bucket(5.35, 0.024, 10.06, 5)  3 "],
            ['width_bucket(operand numeric, b1 numeric, b2 numeric, count int)  RETURNS int', "return the bucket number to which operand would be assigned in a histogram having count equal-width buckets spanning the range b1 to b2; returns 0 or count+1 for an input outside the range\nE.G.: width_bucket(5.35, 0.024, 10.06, 5)  3 "],
            ['width_bucket(operand anyelement, thresholds anyarray)  RETURNS int', "return the bucket number to which operand would be assigned given an array listing the lower bounds of the buckets; returns 0 for an input less than the first lower bound; the thresholds array must be sorted, smallest first, or unexpected results will be obtained\nE.G.: width_bucket(now(), array['yesterday', 'today', 'tomorrow']::timestamptz[])  2 "],
            ['random()  RETURNS dp', "random value in the range 0.0 <= x < 1.0\n   "],
            ['setseed(dp)  RETURNS void', "set seed for subsequent random() calls (value between -1.0 and 1.0, inclusive)\n   "],
            ['acos(x) ', "inverse cosine\n   "],
            ['asin(x) ', "inverse sine\n   "],
            ['atan(x) ', "inverse tangent\n   "],
            ['atan2(y, x) ', "inverse tangent of y/x\n   "],
            ['cos(x) ', "cosine\n   "],
            ['cot(x) ', "cotangent\n   "],
            ['sin(x) ', "sine\n   "],
            ['tan(x) ', "tangent\n   "],
            ['ascii(string)  RETURNS int', "ASCII code of the first character of the argument. For UTF8 returns the Unicode code point of the character. For other multibyte encodings, the argument must be an ASCII character.\nE.G.: ascii('x')  120 "],
            ['btrim(string text [, characters text])  RETURNS text', "Remove the longest string consisting only of characters in characters (a space by default) from the start and end of string\nE.G.: btrim('xyxtrimyyx', 'xy')  trim "],
            ['chr(int)  RETURNS text', "Character with the given code. For UTF8 the argument is treated as a Unicode code point. For other multibyte encodings the argument must designate an ASCII character. The NULL (0) character is not allowed because text data types cannot store such bytes.\nE.G.: chr(65)  A "],
            ['concat(str "any" [, str "any" [, ...] ])  RETURNS text', "Concatenate the text representations of all the arguments. NULL arguments are ignored.\nE.G.: concat('abcde', 2, NULL, 22)  abcde222 "],
            ['concat_ws(sep text, str "any" [, str "any" [, ...] ])  RETURNS text', "Concatenate all but the first argument with separators. The first argument is used as the separator string. NULL arguments are ignored.\nE.G.: concat_ws(',', 'abcde', 2, NULL, 22)  abcde,2,22 "],
            ['convert(string bytea, src_encoding name, dest_encoding name)  RETURNS bytea', "Convert string to dest_encoding. The original encoding is specified by src_encoding. The string must be valid in this encoding. Conversions can be defined by CREATE CONVERSION. Also there are some predefined conversions. See Table 9-8 for available conversions.\nE.G.: convert('text_in_utf8', 'UTF8', 'LATIN1')  text_in_utf8 represented in Latin-1 encoding (ISO 8859-1) "],
            ['convert_from(string bytea, src_encoding name)  RETURNS text', "Convert string to the database encoding. The original encoding is specified by src_encoding. The string must be valid in this encoding.\nE.G.: convert_from('text_in_utf8', 'UTF8')  text_in_utf8 represented in the current database encoding "],
            ['convert_to(string text, dest_encoding name)  RETURNS bytea', "Convert string to dest_encoding.\nE.G.: convert_to('some text', 'UTF8')  some text represented in the UTF8 encoding "],
            ['decode(string text, format text)  RETURNS bytea', "Decode binary data from textual representation in string. Options for format are same as in encode.\nE.G.: decode('MTIzAAE=', 'base64')  \x3132330001 "],
            ['encode(data bytea, format text)  RETURNS text', "Encode binary data into a textual representation. Supported formats are: base64, hex, escape. escape converts zero bytes and high-bit-set bytes to octal sequences (\nnn) and doubles backslashes.\nE.G.: encode(E'123\\000\\001', 'base64')  MTIzAAE= "],
            ['format(formatstr text [, formatarg "any" [, ...] ])  RETURNS text', "Format arguments according to a format string. This function is similar to the C function sprintf. See Section 9.4.1.\nE.G.: format('Hello %s, %1$s', 'World')  Hello World, World "],
            ['initcap(string)  RETURNS text', "Convert the first letter of each word to upper case and the rest to lower case. Words are sequences of alphanumeric characters separated by non-alphanumeric characters.\nE.G.: initcap('hi THOMAS')  Hi Thomas "],
            ['left(str text, n int)  RETURNS text', "Return first n characters in the string. When n is negative, return all but last |n| characters.\nE.G.: left('abcde', 2)  ab "],
            ['length(string)  RETURNS int', "Number of characters in string\nE.G.: length('jose')  4 "],
            ['length(string bytea, encoding name )  RETURNS int', "Number of characters in string in the given encoding. The string must be valid in this encoding.\nE.G.: length('jose', 'UTF8')  4 "],
            ['lpad(string text, length int [, fill text])  RETURNS text', "Fill up the string to length length by prepending the characters fill (a space by default). If the string is already longer than length then it is truncated (on the right).\nE.G.: lpad('hi', 5, 'xy')  xyxhi "],
            ['ltrim(string text [, characters text])  RETURNS text', "Remove the longest string containing only characters from characters (a space by default) from the start of string\nE.G.: ltrim('zzzytrim', 'xyz')  trim "],
            ['md5(string)  RETURNS text', "Calculates the MD5 hash of string, returning the result in hexadecimal\nE.G.: md5('abc')  900150983cd24fb0 d6963f7d28e17f72 "],
            ['pg_client_encoding()  RETURNS name', "Current client encoding name\nE.G.: pg_client_encoding()  SQL_ASCII "],
            ['quote_ident(string text)  RETURNS text', "Return the given string suitably quoted to be used as an identifier in an SQL statement string. Quotes are added only if necessary (i.e., if the string contains non-identifier characters or would be case-folded). Embedded quotes are properly doubled. See also Example 40-1.\nE.G.: quote_ident('Foo bar')  'Foo bar' "],
            ['quote_literal(string text)  RETURNS text', "Return the given string suitably quoted to be used as a string literal in an SQL statement string. Embedded single-quotes and backslashes are properly doubled. Note that quote_literal returns null on null input; if the argument might be null, quote_nullable is often more suitable. See also Example 40-1.\nE.G.: quote_literal(E'O\'Reilly')  'O''Reilly' "],
            ['quote_literal(value anyelement)  RETURNS text', "Coerce the given value to text and then quote it as a literal. Embedded single-quotes and backslashes are properly doubled.\nE.G.: quote_literal(42.5)  '42.5' "],
            ['quote_nullable(string text)  RETURNS text', "Return the given string suitably quoted to be used as a string literal in an SQL statement string; or, if the argument is null, return NULL. Embedded single-quotes and backslashes are properly doubled. See also Example 40-1.\nE.G.: quote_able(NULL)  NULL "],
            ['quote_nullable(value anyelement)  RETURNS text', "Coerce the given value to text and then quote it as a literal; or, if the argument is null, return NULL. Embedded single-quotes and backslashes are properly doubled.\nE.G.: quote_able(42.5)  '42.5' "],
            ['regexp_matches(string text, pattern text [, flags text])  RETURNS setof text[]', "Return all captured substrings resulting from matching a POSIX regular expression against the string. See Section 9.7.3 for more information.\nE.G.: regexp_matches('foobarbequebaz', '(bar)(beque)')  {bar,beque} "],
            ['regexp_replace(string text, pattern text, replacement text [, flags text])  RETURNS text', "Replace substring(s) matching a POSIX regular expression. See Section 9.7.3 for more information.\nE.G.: regexp_replace('Thomas', '.[mN]a.', 'M')  ThM "],
            ['regexp_split_to_array(string text, pattern text [, flags text ])  RETURNS text[]', "Split string using a POSIX regular expression as the delimiter. See Section 9.7.3 for more information.\nE.G.: regexp_split_to_array('hello world', E'\\s+')  {hello,world} "],
            ['regexp_split_to_table(string text, pattern text [, flags text])  RETURNS setof text', "Split string using a POSIX regular expression as the delimiter. See Section 9.7.3 for more information.\nE.G.: regexp_split_to_table('hello world', E'\\s+')  hello world(2 rows) "],
            ['repeat(string text, number int)  RETURNS text', "Repeat string the specified number of times\nE.G.: repeat('Pg', 4)  PgPgPgPg "],
            ['replace(string text, from text, to text)  RETURNS text', "Replace all occurrences in string of substring from with substring to\nE.G.: replace('abcdefabcdef', 'cd', 'XX')  abXXefabXXef "],
            ['reverse(str)  RETURNS text', "Return reversed string.\nE.G.: reverse('abcde')  edcba "],
            ['right(str text, n int)  RETURNS text', "Return last n characters in the string. When n is negative, return all but first |n| characters.\nE.G.: right('abcde', 2)  de "],
            ['rpad(string text, length int [, fill text])  RETURNS text', "Fill up the string to length length by appending the characters fill (a space by default). If the string is already longer than length then it is truncated.\nE.G.: rpad('hi', 5, 'xy')  hixyx "],
            ['rtrim(string text [, characters text])  RETURNS text', "Remove the longest string containing only characters from characters (a space by default) from the end of string\nE.G.: rtrim('trimxxxx', 'x')  trim "],
            ['split_part(string text, delimiter text, field int)  RETURNS text', "Split string on delimiter and return the given field (counting from one)\nE.G.: split_part('abc~@~def~@~ghi', '~@~', 2)  def "],
            ['strpos(string, substring)  RETURNS int', "Location of specified substring (same as position(substring in string), but note the reversed argument order)\nE.G.: strpos('high', 'ig')  2 "],
            ['substr(string, from [, count])  RETURNS text', "Extract substring (same as substring(string from from for count))\nE.G.: substr('alphabet', 3, 2)  ph "],
            ['to_ascii(string text [, encoding text])  RETURNS text', "Convert string to ASCII from another encoding (only supports conversion from LATIN1, LATIN2, LATIN9, and WIN1250 encodings)\nE.G.: to_ascii('Karel')  Karel "],
            ['to_hex(number int or bigint)  RETURNS text', "Convert number to its equivalent hexadecimal representation\nE.G.: to_hex(2147483647)  7fffffff "],
            ['translate(string text, from text, to text)  RETURNS text', "Any character in string that matches a character in the from set is replaced by the corresponding character in the to set. If from is longer than to, occurrences of the extra characters in from are removed.\nE.G.: translate('12345', '143', 'ax')  a2x5 "],
            ['string || string  RETURNS bytea', "String concatenation\nE.G.: E'\\\\Post'::bytea || E'\\047gres\\000'::bytea  \\Post'gres\\000 "],
            ['octet_length(string)  RETURNS int', "Number of bytes in binary string\nE.G.: octet_length(E'jo\\000se'::bytea)  5 "],
            ['overlay(string placing string from int [for int])  RETURNS bytea', "Replace substring\nE.G.: overlay(E'Th\\000omas'::bytea placing E'\\002\\003'::bytea from 2 for 3)  T\\002\\003mas "],
            ['position(substring in string)  RETURNS int', "Location of specified substring\nE.G.: position(E'\\000om'::bytea in E'Th\\000omas'::bytea)  3 "],
            ['substring(string [from int] [for int])  RETURNS bytea', "Extract substring\nE.G.: substring(E'Th\\000omas'::bytea from 2 for 3)  h\\000o "],
            ['trim([both] bytes from string)  RETURNS bytea', "Remove the longest string containing only the bytes in bytes from the start and end of string\nE.G.: trim(E'\\000'::bytea from E'\\000Tom\\000'::bytea)  Tom "],
            ['btrim(string bytea, bytes bytea)  RETURNS bytea', "Remove the longest string consisting only of bytes in bytes from the start and end of string\nE.G.: btrim(E'\\000trim\\000'::bytea, E'\\000'::bytea)  trim "],
            ['decode(string text, format text)  RETURNS bytea', "Decode binary data from textual representation in string. Options for format are same as in encode.\nE.G.: decode(E'123\\000456', 'escape')  12\\00456 "],
            ['encode(data bytea, format text)  RETURNS text', "Encode binary data into a textual representation. Supported formats are: base64, hex, escape. escape converts zero bytes and high-bit-set bytes to octal sequences (\nnn) and doubles backslashes.\nE.G.: encode(E'123\\000456'::bytea, 'escape')  123\\000456 "],
            ['get_bit(string, offset)  RETURNS int', "Extract bit from string\nE.G.: get_bit(E'Th\\000omas'::bytea, 45)  1 "],
            ['get_byte(string, offset)  RETURNS int', "Extract byte from string\nE.G.: get_byte(E'Th\\000omas'::bytea, 4)  109 "],
            ['length(string)  RETURNS int', "Length of binary string\nE.G.: length(E'jo\\000se'::bytea)  5 "],
            ['md5(string)  RETURNS text', "Calculates the MD5 hash of string, returning the result in hexadecimal\nE.G.: md5(E'Th\\000omas'::bytea)  8ab2d3c9689aaf18 b4958c334c82d8b1 "],
            ['set_bit(string, offset, newvalue)  RETURNS bytea', "Set bit in string\nE.G.: set_bit(E'Th\\000omas'::bytea, 45, 0)  T\\$100omAs "],
            ['set_byte(string, offset, newvalue)  RETURNS bytea', "Set byte in string\nE.G.: set_byte(E'Th\\000omas'::bytea, 4, 64)  T\\00o@as "],
            ['to_char(timestamp, text)  RETURNS text', "convert time stamp to string\nE.G.: to_char(current_timestamp, 'HH12:MI:SS')   "],
            ['to_char(interval, text)  RETURNS text', "convert interval to string\nE.G.: to_char(interval '15h 2m 12s', 'HH24:MI:SS')   "],
            ['to_char(int, text)  RETURNS text', "convert integer to string\nE.G.: to_char(125, '999')   "],
            ['to_char(double precision, text)  RETURNS text', "convert real/double precision to string\nE.G.: to_char(125.8::real, '999D9')   "],
            ['to_char(numeric, text)  RETURNS text', "convert numeric to string\nE.G.: to_char(-125.8, '999D99S')   "],
            ['to_date(text, text)  RETURNS date', "convert string to date\nE.G.: to_date('05 Dec 2000', 'DD Mon YYYY')   "],
            ['to_number(text, text)  RETURNS numeric', "convert string to numeric\nE.G.: to_number('12,454.8-', '99G999D9S')   "],
            ['to_timestamp(text, text)  RETURNS timestamp with time zone', "convert string to time stamp\nE.G.: to_timestamp('05 Dec 2000', 'DD Mon YYYY')   "],
            ['to_timestamp(double precision)  RETURNS timestamp with time zone', "convert Unix epoch to time stamp\nE.G.: to_timestamp(1284352323)   "],
            ['age(timestamp, timestamp)  RETURNS interval', "Subtract arguments, producing a 'symbolic' result that uses years and months, rather than just days\nE.G.: age(timestamp '2001-04-10', timestamp '1957-06-13')  43 years 9 mons 27 days "],
            ['age(timestamp)  RETURNS interval', "Subtract from current_date (at midnight)\nE.G.: age(timestamp '1957-06-13')  43 years 8 mons 3 days "],
            ['clock_timestamp()  RETURNS timestamp with time zone', "Current date and time (changes during statement execution); see Section 9.9.4\nE.G.:    "],
            ['current_date  RETURNS date', "Current date; see Section 9.9.4\nE.G.:    "],
            ['current_time  RETURNS time with time zone', "Current time of day; see Section 9.9.4\nE.G.:    "],
            ['current_timestamp  RETURNS timestamp with time zone', "Current date and time (start of current transaction); see Section 9.9.4\nE.G.:    "],
            ['date_part(text, timestamp)  RETURNS double precision', "Get subfield (equivalent to extract); see Section 9.9.1\nE.G.: date_part('hour', timestamp '2001-02-16 20:38:40')  20 "],
            ['date_part(text, interval)  RETURNS double precision', "Get subfield (equivalent to extract); see Section 9.9.1\nE.G.: date_part('month', interval '2 years 3 months')  3 "],
            ['date_trunc(text, timestamp)  RETURNS timestamp', "Truncate to specified precision; see also Section 9.9.2\nE.G.: date_trunc('hour', timestamp '2001-02-16 20:38:40')  2001-02-16 20:00:00 "],
            ['date_trunc(text, interval)  RETURNS interval', "Truncate to specified precision; see also Section 9.9.2\nE.G.: date_trunc('hour', interval '2 days 3 hours 40 minutes')  2 days 03:00:00 "],
            ['extract(field from timestamp)  RETURNS double precision', "Get subfield; see Section 9.9.1\nE.G.: extract(hour from timestamp '2001-02-16 20:38:40')  20 "],
            ['extract(field from interval)  RETURNS double precision', "Get subfield; see Section 9.9.1\nE.G.: extract(month from interval '2 years 3 months')  3 "],
            ['isfinite(date)  RETURNS boolean', "Test for finite date (not +/-infinity)\nE.G.: isfinite(date '2001-02-16')  true "],
            ['isfinite(timestamp)  RETURNS boolean', "Test for finite time stamp (not +/-infinity)\nE.G.: isfinite(timestamp '2001-02-16 21:28:30')  true "],
            ['isfinite(interval)  RETURNS boolean', "Test for finite interval\nE.G.: isfinite(interval '4 hours')  true "],
            ['justify_days(interval)  RETURNS interval', "Adjust interval so 30-day time periods are represented as months\nE.G.: justify_days(interval '35 days')  1 mon 5 days "],
            ['justify_hours(interval)  RETURNS interval', "Adjust interval so 24-hour time periods are represented as days\nE.G.: justify_hours(interval '27 hours')  1 day 03:00:00 "],
            ['justify_interval(interval)  RETURNS interval', "Adjust interval using justify_days and justify_hours, with additional sign adjustments\nE.G.: justify_interval(interval '1 mon -1 hour')  29 days 23:00:00 "],
            ['localtime  RETURNS time', "Current time of day; see Section 9.9.4\nE.G.:    "],
            ['localtimestamp  RETURNS timestamp', "Current date and time (start of current transaction); see Section 9.9.4\nE.G.:    "],
            ['make_date(year int, month int, day int)  RETURNS date', "Create date from year, month and day fields\nE.G.: make_date(2013, 7, 15)  2013-07-15 "],
            ['make_interval(years int DEFAULT 0, months int DEFAULT 0, weeks int DEFAULT 0, days int DEFAULT 0, hours int DEFAULT 0, mins int DEFAULT 0, secs double precision DEFAULT 0.0)  RETURNS interval', "Create interval from years, months, weeks, days, hours, minutes and seconds fields\nE.G.: make_interval(days => 10)  10 days "],
            ['make_time(hour int, min int, sec double precision)  RETURNS time', "Create time from hour, minute and seconds fields\nE.G.: make_time(8, 15, 23.5)  08:15:23.5 "],
            ['make_timestamp(year int, month int, day int, hour int, min int, sec double precision)  RETURNS timestamp', "Create timestamp from year, month, day, hour, minute and seconds fields\nE.G.: make_timestamp(2013, 7, 15, 8, 15, 23.5)  2013-07-15 08:15:23.5 "],
            ['make_timestamptz(year int, month int, day int, hour int, min int, sec double precision, [ timezone text ])  RETURNS timestamp with time zone', "Create timestamp with time zone from year, month, day, hour, minute and seconds fields. When timezone is not specified, then current time zone is used.\nE.G.: make_timestamptz(2013, 7, 15, 8, 15, 23.5)  2013-07-15 08:15:23.5+01 "],
            ['now()  RETURNS timestamp with time zone', "Current date and time (start of current transaction); see Section 9.9.4\nE.G.:    "],
            ['statement_timestamp()  RETURNS timestamp with time zone', "Current date and time (start of current statement); see Section 9.9.4\nE.G.:    "],
            ['timeofday()  RETURNS text', "Current date and time (like clock_timestamp, but as a text string); see Section 9.9.4\nE.G.:    "],
            ['transaction_timestamp()  RETURNS timestamp with time zone', "Current date and time (start of current transaction); see Section 9.9.4\nE.G.:    "],
            ['enum_first(anyenum) ', "Returns the first value of the input enum type\nE.G.: enum_first(::rainbow)   red"],
            ['enum_last(anyenum) ', "Returns the last value of the input enum type\nE.G.: enum_last(::rainbow)   purple"],
            ['enum_range(anyenum) ', "Returns all values of the input enum type in an ordered array\nE.G.: enum_range(::rainbow)   {red,orange,yellow,green,blue,purple}"],
            ['enum_range(anyenum, anyenum) ', "Returns the range between the two given enum values, as an ordered array. The values must be from the same enum type. If the first parameter is null, the result will start with the first value of the enum type. If the second parameter is null, the result will end with the last value of the enum type.\nE.G.: enum_range('orange'::rainbow, 'green'::rainbow)   {orange,yellow,green}"],
            ['enum_range(anyenum, anyenum) ', "Returns the range between the two given enum values, as an ordered array. The values must be from the same enum type. If the first parameter is null, the result will start with the first value of the enum type. If the second parameter is null, the result will end with the last value of the enum type.\nE.G.: enum_range(NULL, 'green'::rainbow)   {red,orange,yellow,green}"],
            ['enum_range(anyenum, anyenum) ', "Returns the range between the two given enum values, as an ordered array. The values must be from the same enum type. If the first parameter is null, the result will start with the first value of the enum type. If the second parameter is null, the result will end with the last value of the enum type.\nE.G.: enum_range('orange'::rainbow, NULL)   {orange,yellow,green,blue,purple}"],
            ['area(object)  RETURNS double precision', "area\nE.G.: area(box '((0,0),(1,1))')   "],
            ['center(object)  RETURNS point', "center\nE.G.: center(box '((0,0),(1,2))')   "],
            ['diameter(circle)  RETURNS double precision', "diameter of circle\nE.G.: diameter(circle '((0,0),2.0)')   "],
            ['height(box)  RETURNS double precision', "vertical size of box\nE.G.: height(box '((0,0),(1,1))')   "],
            ['isclosed(path)  RETURNS boolean', "a closed path?\nE.G.: isclosed(path '((0,0),(1,1),(2,0))')   "],
            ['isopen(path)  RETURNS boolean', "an open path?\nE.G.: isopen(path '[(0,0),(1,1),(2,0)]')   "],
            ['length(object)  RETURNS double precision', "length\nE.G.: length(path '((-1,0),(1,0))')   "],
            ['npoints(path)  RETURNS int', "number of points\nE.G.: npoints(path '[(0,0),(1,1),(2,0)]')   "],
            ['npoints(polygon)  RETURNS int', "number of points\nE.G.: npoints(polygon '((1,1),(0,0))')   "],
            ['pclose(path)  RETURNS path', "convert path to closed\nE.G.: pclose(path '[(0,0),(1,1),(2,0)]')   "],
            ['popen(path)  RETURNS path', "convert path to open\nE.G.: popen(path '((0,0),(1,1),(2,0))')   "],
            ['radius(circle)  RETURNS double precision', "radius of circle\nE.G.: radius(circle '((0,0),2.0)')   "],
            ['width(box)  RETURNS double precision', "horizontal size of box\nE.G.: width(box '((0,0),(1,1))')   "],
            ['box(circle)  RETURNS box', "circle to box\nE.G.: box(circle '((0,0),2.0)')   "],
            ['box(point)  RETURNS box', "point to empty box\nE.G.: box(point '(0,0)')   "],
            ['box(point, point)  RETURNS box', "points to box\nE.G.: box(point '(0,0)', point '(1,1)')   "],
            ['box(polygon)  RETURNS box', "polygon to box\nE.G.: box(polygon '((0,0),(1,1),(2,0))')   "],
            ['bound_box(box, box)  RETURNS box', "boxes to bounding box\nE.G.: bound_box(box '((0,0),(1,1))', box '((3,3),(4,4))')   "],
            ['circle(box)  RETURNS circle', "box to circle\nE.G.: circle(box '((0,0),(1,1))')   "],
            ['circle(point, double precision)  RETURNS circle', "center and radius to circle\nE.G.: circle(point '(0,0)', 2.0)   "],
            ['circle(polygon)  RETURNS circle', "polygon to circle\nE.G.: circle(polygon '((0,0),(1,1),(2,0))')   "],
            ['line(point, point)  RETURNS line', "points to line\nE.G.: line(point '(-1,0)', point '(1,0)')   "],
            ['lseg(box)  RETURNS lseg', "box diagonal to line segment\nE.G.: lseg(box '((-1,0),(1,0))')   "],
            ['lseg(point, point)  RETURNS lseg', "points to line segment\nE.G.: lseg(point '(-1,0)', point '(1,0)')   "],
            ['path(polygon)  RETURNS path', "polygon to path\nE.G.: path(polygon '((0,0),(1,1),(2,0))')   "],
            ['point(double precision, double precision)  RETURNS point', "construct point\nE.G.: point(23.4, -44.5)   "],
            ['point(box)  RETURNS point', "center of box\nE.G.: point(box '((-1,0),(1,0))')   "],
            ['point(circle)  RETURNS point', "center of circle\nE.G.: point(circle '((0,0),2.0)')   "],
            ['point(lseg)  RETURNS point', "center of line segment\nE.G.: point(lseg '((-1,0),(1,0))')   "],
            ['point(polygon)  RETURNS point', "center of polygon\nE.G.: point(polygon '((0,0),(1,1),(2,0))')   "],
            ['polygon(box)  RETURNS polygon', "box to 4-point polygon\nE.G.: polygon(box '((0,0),(1,1))')   "],
            ['polygon(circle)  RETURNS polygon', "circle to 12-point polygon\nE.G.: polygon(circle '((0,0),2.0)')   "],
            ['polygon(npts, circle)  RETURNS polygon', "circle to npts-point polygon\nE.G.: polygon(12, circle '((0,0),2.0)')   "],
            ['polygon(path)  RETURNS polygon', "path to polygon\nE.G.: polygon(path '((0,0),(1,1),(2,0))')   "],
            ['abbrev(inet)  RETURNS text', "abbreviated display format as text\nE.G.: abbrev(inet '10.1.0.0/16')  10.1.0.0/16 "],
            ['abbrev(cidr)  RETURNS text', "abbreviated display format as text\nE.G.: abbrev(cidr '10.1.0.0/16')  10.1/16 "],
            ['broadcast(inet)  RETURNS inet', "broadcast address for network\nE.G.: broadcast('192.168.1.5/24')  192.168.1.255/24 "],
            ['family(inet)  RETURNS int', "extract family of address; 4 for IPv4, 6 for IPv6\nE.G.: family('::1')  6 "],
            ['host(inet)  RETURNS text', "extract IP address as text\nE.G.: host('192.168.1.5/24')  192.168.1.5 "],
            ['hostmask(inet)  RETURNS inet', "construct host mask for network\nE.G.: hostmask('192.168.23.20/30')  0.0.0.3 "],
            ['masklen(inet)  RETURNS int', "extract netmask length\nE.G.: masklen('192.168.1.5/24')  24 "],
            ['netmask(inet)  RETURNS inet', "construct netmask for network\nE.G.: netmask('192.168.1.5/24')  255.255.255.0 "],
            ['network(inet)  RETURNS cidr', "extract network part of address\nE.G.: network('192.168.1.5/24')  192.168.1.0/24 "],
            ['set_masklen(inet, int)  RETURNS inet', "set netmask length for inet value\nE.G.: set_masklen('192.168.1.5/24', 16)  192.168.1.5/16 "],
            ['set_masklen(cidr, int)  RETURNS cidr', "set netmask length for cidr value\nE.G.: set_masklen('192.168.1.0/24'::cidr, 16)  192.168.0.0/16 "],
            ['text(inet)  RETURNS text', "extract IP address and netmask length as text\nE.G.: text(inet '192.168.1.5')  192.168.1.5/32 "],
            ['inet_same_family(inet, inet)  RETURNS boolean', "are the addresses from the same family?\nE.G.: inet_same_family('192.168.1.5/24', '::1')  false "],
            ['inet_merge(inet, inet)  RETURNS cidr', "the smallest network which includes both of the given networks\nE.G.: inet_merge('192.168.1.5/24', '192.168.2.5/24')  192.168.0.0/22 "],
            ['trunc(macaddr)  RETURNS macaddr', "set last 3 bytes to zero\nE.G.: trunc(macaddr '12:34:56:78:90:ab')  12:34:56:00:00:00 "],
            ['get_current_ts_config()  RETURNS regconfig', "get default text search configuration\nE.G.: get_current_ts_config()  english "],
            ['length(tsvector)  RETURNS integer', "number of lexemes in tsvector\nE.G.: length('fat:2,4 cat:3 rat:5A'::tsvector)  3 "],
            ['numnode(tsquery)  RETURNS integer', "number of lexemes plus operators in tsquery\nE.G.: numnode('(fat & rat) | cat'::tsquery)  5 "],
            ['plainto_tsquery([ config regconfig , ] query text)  RETURNS tsquery', "produce tsquery ignoring punctuation\nE.G.: plainto_tsquery('english', 'The Fat Rats')  'fat' & 'rat' "],
            ['querytree(query tsquery)  RETURNS text', "get indexable part of a tsquery\nE.G.: querytree('foo & ! bar'::tsquery)  'foo' "],
            ['setweight(tsvector, "char")  RETURNS tsvector', "assign weight to each element of tsvector\nE.G.: setweight('fat:2,4 cat:3 rat:5B'::tsvector, 'A')  'cat':3A 'fat':2A,4A 'rat':5A "],
            ['strip(tsvector)  RETURNS tsvector', "remove positions and weights from tsvector\nE.G.: strip('fat:2,4 cat:3 rat:5A'::tsvector)  'cat' 'fat' 'rat' "],
            ['to_tsquery([ config regconfig , ] query text)  RETURNS tsquery', "normalize words and convert to tsquery\nE.G.: to_tsquery('english', 'The & Fat & Rats')  'fat' & 'rat' "],
            ['to_tsvector([ config regconfig , ] document text)  RETURNS tsvector', "reduce document text to tsvector\nE.G.: to_tsvector('english', 'The Fat Rats')  'fat':2 'rat':3 "],
            ['ts_headline([ config regconfig, ] document text, query tsquery [, options text ])  RETURNS text', "display a query match\nE.G.: ts_headline('x y z', 'z'::tsquery)  x y <b>z</b> "],
            ['ts_rank([ weights float4[], ] vector tsvector, query tsquery [, normalization integer ])  RETURNS float4', "rank document for query\nE.G.: ts_rank(textsearch, query)  0.818 "],
            ['ts_rank_cd([ weights float4[], ] vector tsvector, query tsquery [, normalization integer ])  RETURNS float4', "rank document for query using cover density\nE.G.: ts_rank_cd('{0.1, 0.2, 0.4, 1.0}', textsearch, query)  2.01317 "],
            ['ts_rewrite(query tsquery, target tsquery, substitute tsquery)  RETURNS tsquery', "replace target with substitute within query\nE.G.: ts_rewrite('a & b'::tsquery, 'a'::tsquery, 'foo|bar'::tsquery)  'b' & ( 'foo' | 'bar' ) "],
            ['ts_rewrite(query tsquery, select text)  RETURNS tsquery', "replace using targets and substitutes from a SELECT command\nE.G.: SELECT ts_rewrite('a & b'::tsquery, 'SELECT t,s FROM aliases')  'b' & ( 'foo' | 'bar' ) "],
            ['tsvector_update_trigger()  RETURNS trigger', "trigger function for automatic tsvector column update\nE.G.: CREATE TRIGGER ... tsvector_update_trigger(tsvcol, 'pg_catalog.swedish', title, body)   "],
            ['tsvector_update_trigger_column()  RETURNS trigger', "trigger function for automatic tsvector column update\nE.G.: CREATE TRIGGER ... tsvector_update_trigger_column(tsvcol, configcol, title, body)   "],
            ['ts_debug([ config regconfig, ] document text, OUT alias text, OUT description text, OUT token text, OUT dictionaries regdictionary[], OUT dictionary regdictionary, OUT lexemes text[])  RETURNS setof record', "test a configuration\nE.G.: ts_debug('english', 'The Brightest supernovaes')  (asciiword,'Word, all ASCII',The,{english_stem},english_stem,{}) ... "],
            ['ts_lexize(dict regdictionary, token text)  RETURNS text[]', "test a dictionary\nE.G.: ts_lexize('english_stem', 'stars')  {star} "],
            ['ts_parse(parser_name text, document text, OUT tokid integer, OUT token text)  RETURNS setof record', "test a parser\nE.G.: ts_parse('default', 'foo - bar')  (1,foo) ... "],
            ['ts_parse(parser_oid oid, document text, OUT tokid integer, OUT token text)  RETURNS setof record', "test a parser\nE.G.: ts_parse(3722, 'foo - bar')  (1,foo) ... "],
            ['ts_token_type(parser_name text, OUT tokid integer, OUT alias text, OUT description text)  RETURNS setof record', "get token types defined by parser\nE.G.: ts_token_type('default')  (1,asciiword,'Word, all ASCII') ... "],
            ['ts_token_type(parser_oid oid, OUT tokid integer, OUT alias text, OUT description text)  RETURNS setof record', "get token types defined by parser\nE.G.: ts_token_type(3722)  (1,asciiword,'Word, all ASCII') ... "],
            ['ts_stat(sqlquery text, [ weights text, ] OUT word text, OUT ndoc integer, OUT nentry integer)  RETURNS setof record', "get statistics of a tsvector column\nE.G.: ts_stat('SELECT vector from apod')  (foo,10,15) ... "],
            ['to_json(anyelement)to_jsonb(anyelement) ', "Returns the value as json or jsonb. Arrays and composites are converted (recursively) to arrays and objects; otherwise, if there is a cast from the type to json, the cast function will be used to perform the conversion; otherwise, a scalar value is produced. For any scalar type other than a number, a Boolean, or a null value, the text representation will be used, in such a fashion that it is a valid json or jsonb value.\nE.G.: to_json('Fred said 'Hi.''::text)   'Fred said \'Hi.\''"],
            ['array_to_json(anyarray [, pretty_bool]) ', "Returns the array as a JSON array. A PostgreSQL multidimensional array becomes a JSON array of arrays. Line feeds will be added between dimension-1 elements if pretty_bool is true.\nE.G.: array_to_json('{{1,5},{99,100}}'::int[])   [[1,5],[99,100]]"],
            ['row_to_json(record [, pretty_bool]) ', "Returns the row as a JSON object. Line feeds will be added between level-1 elements if pretty_bool is true.\nE.G.: row_to_json(row(1,'foo'))   {'f1':1,'f2':'foo'}"],
            ['json_build_array(VARIADIC "any")jsonb_build_array(VARIADIC "any") ', "Builds a possibly-heterogeneously-typed JSON array out of a variadic argument list.\nE.G.: json_build_array(1,2,'3',4,5)   [1, 2, '3', 4, 5]"],
            ['json_build_object(VARIADIC "any")jsonb_build_object(VARIADIC "any") ', "Builds a JSON object out of a variadic argument list. By convention, the argument list consists of alternating keys and values.\nE.G.: json_build_object('foo',1,'bar',2)   {'foo': 1, 'bar': 2}"],
            ['json_object(text[])jsonb_object(text[]) ', "Builds a JSON object out of a text array. The array must have either exactly one dimension with an even number of members, in which case they are taken as alternating key/value pairs, or two dimensions such that each inner array has exactly two elements, which are taken as a key/value pair.\nE.G.: json_object('{a, 1, b, 'def', c, 3.5}')json_object('{{a, 1},{b, 'def'},{c, 3.5}}')   {'a': '1', 'b': 'def', 'c': '3.5'}"],
            ['json_object(keys text[], values text[])jsonb_object(keys text[], values text[]) ', "This form of json_object takes keys and values pairwise from two separate arrays. In all other respects it is identical to the one-argument form.\nE.G.: json_object('{a, b}', '{1,2}')   {'a': '1', 'b': '2'}"],
            ['json_array_length(json)jsonb_array_length(jsonb)  RETURNS int', "Returns the number of elements in the outermost JSON array.\nE.G.: json_array_length('[1,2,3,{'f1':1,'f2':[5,6]},4]')   5"],
            ['json_each(json)jsonb_each(jsonb)  RETURNS setof key text, value jsonsetof key text, value jsonb', "Expands the outermost JSON object into a set of key/value pairs.\nE.G.: select * from json_each('{'a':'foo', 'b':'bar'}')   key | value\n -----+-------\n  a   | 'foo'\n  b   | 'bar'"],
            ['json_each_text(json)jsonb_each_text(jsonb)  RETURNS setof key text, value text', "Expands the outermost JSON object into a set of key/value pairs. The returned values will be of type text.\nE.G.: select * from json_each_text('{'a':'foo', 'b':'bar'}')   key | value\n -----+-------\n  a   | foo\n  b   | bar"],
            ['json_extract_path(from_json json, VARIADIC path_elems text[])jsonb_extract_path(from_json jsonb, VARIADIC path_elems text[])  RETURNS jsonjsonb', "Returns JSON value pointed to by path_elems (equivalent to #> operator).\nE.G.: json_extract_path('{'f2':{'f3':1},'f4':{'f5':99,'f6':'foo'}}','f4')   {'f5':99,'f6':'foo'}"],
            ['json_extract_path_text(from_json json, VARIADIC path_elems text[])jsonb_extract_path_text(from_json jsonb, VARIADIC path_elems text[])  RETURNS text', "Returns JSON value pointed to by path_elems as text (equivalent to #>> operator).\nE.G.: json_extract_path_text('{'f2':{'f3':1},'f4':{'f5':99,'f6':'foo'}}','f4', 'f6')   foo"],
            ['json_object_keys(json)jsonb_object_keys(jsonb)  RETURNS setof text', "Returns set of keys in the outermost JSON object.\nE.G.: json_object_keys('{'f1':'abc','f2':{'f3':'a', 'f4':'b'}}')   json_object_keys\n ------------------\n  f1\n  f2"],
            ['json_populate_record(base anyelement, from_json json)jsonb_populate_record(base anyelement, from_json jsonb)  RETURNS anyelement', "Expands the object in from_json to a row whose columns match the record type defined by base (see note below).\nE.G.: select * from json_populate_record(::myrowtype'{'a':1,'b':2}')   a | b\n ---+---\n  1 | 2"],
            ['json_populate_recordset(base anyelement, from_json json)jsonb_populate_recordset(base anyelement, from_json jsonb)  RETURNS setof anyelement', "Expands the outermost array of objects in from_json to a set of rows whose columns match the record type defined by base (see note below).\nE.G.: select * from json_populate_recordset(::myrowtype, '[{'a':1,'b':2},{'a':3,'b':4}]')   a | b\n ---+---\n  1 | 2\n  3 | 4"],
            ['json_array_elements(json)jsonb_array_elements(jsonb)  RETURNS setof jsonsetof jsonb', "Expands a JSON array to a set of JSON values.\nE.G.: select * from json_array_elements('[1,true, [2,false]]')   value\n -----------\n  1\n  true\n  [2,false]"], ['json_array_elements_text(json)jsonb_array_elements_text(jsonb)  RETURNS setof text', "Expands a JSON array to a set of text values.\nE.G.: select * from json_array_elements_text('['foo', 'bar']')   value\n -----------\n  foo\n  bar"],
            ['json_typeof(json)jsonb_typeof(jsonb)  RETURNS text', "Returns the type of the outermost JSON value as a text string. Possible types are object, array, string, number, boolean, and null.\nE.G.: json_typeof('-123.4')   number"], ['json_to_record(json)jsonb_to_record(jsonb)  RETURNS record', "Builds an arbitrary record from a JSON object (see note below). As with all functions returning record, the caller must explicitly define the structure of the record with an AS clause.\nE.G.: select * from json_to_record('{'a':1,'b':[1,2,3],'c':'bar'}') as x(a int, b text, d text)   a |    b    | d\n ---+---------+---\n  1 | [1,2,3] |"],
            ['json_to_recordset(json)jsonb_to_recordset(jsonb)  RETURNS setof record', "Builds an arbitrary set of records from a JSON array of objects (see note below). As with all functions returning record, the caller must explicitly define the structure of the record with an AS clause.\nE.G.: select * from json_to_recordset('[{'a':1,'b':'foo'},{'a':'2','c':'bar'}]') as x(a int, b text);   a |  b\n ---+-----\n  1 | foo\n  2 |"],
            ['json_strip_nulls(from_json json)jsonb_strip_nulls(from_json jsonb)  RETURNS jsonjsonb', "Returns from_json with all object fields that have null values omitted. Other null values are untouched.\nE.G.: json_strip_s('[{'f1':1,'f2':},2,,3]')   [{'f1':1},2,null,3]"],
            ['jsonb_set(target jsonb, path text[], new_value jsonb[, create_missing boolean])  RETURNS jsonb', "Returns target with the section designated by path replaced by new_value, or with new_value added if create_missing is true ( default is true) and the item designated by path does not exist. As with the path orientated operators, negative integers that appear in path count from the end of JSON arrays.\nE.G.: jsonb_set('[{'f1':1,'f2':},2,,3]', '{0,f1}','[2,3,4]', false)jsonb_set('[{'f1':1,'f2':},2]', '{0,f3}','[2,3,4]')   [{'f1':[2,3,4],'f2':null},2,null,3][{'f1': 1, 'f2': null, 'f3': [2, 3, 4]}, 2]"],
            ['jsonb_pretty(from_json jsonb)  RETURNS text', "Returns from_json as indented JSON text.\nE.G.: jsonb_pretty('[{'f1':1,'f2':},2,,3]')   [\n     {\n         'f1': 1,\n         'f2': null\n     },\n     2,\n     null,\n     3\n ]"],
            ['currval(regclass)  RETURNS bigint', "Return value most recently obtained with nextval for specified sequence\n   "],
            ['lastval()  RETURNS bigint', "Return value most recently obtained with nextval for any sequence\n   "],
            ['nextval(regclass)  RETURNS bigint', "Advance sequence and return new value\n   "],
            ['setval(regclass, bigint)  RETURNS bigint', "Set sequence's current value\n   "],
            ['setval(regclass, bigint, boolean)  RETURNS bigint', "Set sequence's current value and is_called flag\n   "],
            ['array_append(anyarray, anyelement)  RETURNS anyarray', "append an element to the end of an array\nE.G.: array_append(ARRAY[1,2], 3)  {1,2,3} "],
            ['array_cat(anyarray, anyarray)  RETURNS anyarray', "concatenate two arrays\nE.G.: array_cat(ARRAY[1,2,3], ARRAY[4,5])  {1,2,3,4,5} "],
            ['array_ndims(anyarray)  RETURNS int', "returns the number of dimensions of the array\nE.G.: array_ndims(ARRAY[[1,2,3], [4,5,6]])  2 "],
            ['array_dims(anyarray)  RETURNS text', "returns a text representation of array's dimensions\nE.G.: array_dims(ARRAY[[1,2,3], [4,5,6]])  [1:2][1:3] "],
            ['array_fill(anyelement, int[], [, int[]])  RETURNS anyarray', "returns an array initialized with supplied value and dimensions, optionally with lower bounds other than 1\nE.G.: array_fill(7, ARRAY[3], ARRAY[2])  [2:4]={7,7,7} "],
            ['array_length(anyarray, int)  RETURNS int', "returns the length of the requested array dimension\nE.G.: array_length(array[1,2,3], 1)  3 "],
            ['array_lower(anyarray, int)  RETURNS int', "returns lower bound of the requested array dimension\nE.G.: array_lower('[0:2]={1,2,3}'::int[], 1)  0 "],
            ['array_position(anyarray, anyelement [, int])  RETURNS int', "returns the subscript of the first occurrence of the second argument in the array, starting at the element indicated by the third argument or at the first element (array must be one-dimensional)\nE.G.: array_position(ARRAY['sun','mon','tue','wed','thu','fri','sat'], 'mon')  2 "],
            ['array_positions(anyarray, anyelement)  RETURNS int[]', "returns an array of subscripts of all occurrences of the second argument in the array given as first argument (array must be one-dimensional)\nE.G.: array_positions(ARRAY['A','A','B','A'], 'A')  {1,2,4} "],
            ['array_prepend(anyelement, anyarray)  RETURNS anyarray', "append an element to the beginning of an array\nE.G.: array_prepend(1, ARRAY[2,3])  {1,2,3} "],
            ['array_remove(anyarray, anyelement)  RETURNS anyarray', "remove all elements equal to the given value from the array (array must be one-dimensional)\nE.G.: array_remove(ARRAY[1,2,3,2], 2)  {1,3} "],
            ['array_replace(anyarray, anyelement, anyelement)  RETURNS anyarray', "replace each array element equal to the given value with a new value\nE.G.: array_replace(ARRAY[1,2,5,4], 5, 3)  {1,2,3,4} "],
            ['array_to_string(anyarray, text [, text])  RETURNS text', "concatenates array elements using supplied delimiter and optional null string\nE.G.: array_to_string(ARRAY[1, 2, 3, NULL, 5], ',', '*')  1,2,3,*,5 "],
            ['array_upper(anyarray, int)  RETURNS int', "returns upper bound of the requested array dimension\nE.G.: array_upper(ARRAY[1,8,3,7], 1)  4 "],
            ['cardinality(anyarray)  RETURNS int', "returns the total number of elements in the array, or 0 if the array is empty\nE.G.: cardinality(ARRAY[[1,2],[3,4]])  4 "],
            ['string_to_array(text, text [, text])  RETURNS text[]', "splits string into array elements using supplied delimiter and optional null string\nE.G.: string_to_array('xx~^~yy~^~zz', '~^~', 'yy')  {xx,NULL,zz} "],
            ['unnest(anyarray)  RETURNS setof anyelement', "expand an array to a set of rows\nE.G.: unnest(ARRAY[1,2])  1\n 2(2 rows) "],
            ['unnest(anyarray, anyarray [, ...])  RETURNS setof anyelement, anyelement [, ...]', "expand multiple arrays (possibly of different types) to a set of rows. This is only allowed in the FROM clause; see Section 7.2.1.4\nE.G.: unnest(ARRAY[1,2],ARRAY['foo','bar','baz'])  1    foo\n 2    bar\n NULL baz(3 rows) "],
            ['lower(anyrange)  RETURNS range\'s element type', "lower bound of range\nE.G.: lower(numrange(1.1,2.2))  1.1 "],
            ['upper(anyrange)  RETURNS range\'s element type', "upper bound of range\nE.G.: upper(numrange(1.1,2.2))  2.2 "],
            ['isempty(anyrange)  RETURNS boolean', "is the range empty?\nE.G.: isempty(numrange(1.1,2.2))  false "],
            ['lower_inc(anyrange)  RETURNS boolean', "is the lower bound inclusive?\nE.G.: lower_inc(numrange(1.1,2.2))  true "],
            ['upper_inc(anyrange)  RETURNS boolean', "is the upper bound inclusive?\nE.G.: upper_inc(numrange(1.1,2.2))  false "],
            ['lower_inf(anyrange)  RETURNS boolean', "is the lower bound infinite?\nE.G.: lower_inf('(,)'::daterange)  true "],
            ['upper_inf(anyrange)  RETURNS boolean', "is the upper bound infinite?\nE.G.: upper_inf('(,)'::daterange)  true "],
            ['range_merge(anyrange, anyrange)  RETURNS anyrange', "the smallest range which includes both of the given ranges\nE.G.: range_merge('[1,2)'::int4range, '[3,4)'::int4range)  [1,4) "],
            ['corr(Y, X)  RETURNS double precision', "correlation coefficient\n   "],
            ['covar_pop(Y, X)  RETURNS double precision', "population covariance\n   "],
            ['covar_samp(Y, X)  RETURNS double precision', "sample covariance\n   "],
            ['regr_avgx(Y, X)  RETURNS double precision', "average of the independent variable (sum(X)/N)\n   "],
            ['regr_avgy(Y, X)  RETURNS double precision', "average of the dependent variable (sum(Y)/N)\n   "],
            ['regr_count(Y, X)  RETURNS bigint', "number of input rows in which both expressions are nonnull\n   "],
            ['regr_intercept(Y, X)  RETURNS double precision', "y-intercept of the least-squares-fit linear equation determined by the (X, Y) pairs\n   "],
            ['regr_r2(Y, X)  RETURNS double precision', "square of the correlation coefficient\n   "],
            ['regr_slope(Y, X)  RETURNS double precision', "slope of the least-squares-fit linear equation determined by the (X, Y) pairs\n   "],
            ['regr_sxx(Y, X)  RETURNS double precision', "sum(X^2) - sum(X)^2/N ('sum of squares' of the independent variable)\n   "],
            ['regr_sxy(Y, X)  RETURNS double precision', "sum(X*Y) - sum(X) * sum(Y)/N ('sum of products' of independent times dependent variable)\n   "],
            ['regr_syy(Y, X)  RETURNS double precision', "sum(Y^2) - sum(Y)^2/N ('sum of squares' of the dependent variable)\n   "],
            ['stddev(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "historical alias for stddev_samp\n   "],
            ['stddev_pop(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "population standard deviation of the input values\n   "],
            ['stddev_samp(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "sample standard deviation of the input values\n   "],
            ['variance(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "historical alias for var_samp\n   "],
            ['var_pop(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "population variance of the input values (square of the population standard deviation)\n   "],
            ['var_samp(expression)  RETURNS double precision for floating-point arguments, otherwise numeric', "sample variance of the input values (square of the sample standard deviation)\n   "],
            ['array_agg(expression)  RETURNS array of the argument type', "input values, including nulls, concatenated into an array\n   "],
            ['array_agg(expression)  RETURNS same as argument data type', "input arrays concatenated into array of one higher dimension (inputs must all have same dimensionality, and cannot be empty or NULL)\n   "],
            ['avg(expression)  RETURNS numeric for any integer-type argument, double precision for a floating-point argument, otherwise the same as the argument data type', "the average (arithmetic mean) of all input values\n   "],
            ['bit_and(expression)  RETURNS same as argument data type', "the bitwise AND of all non-null input values, or null if none\n   "],
            ['bit_or(expression)  RETURNS same as argument data type', "the bitwise OR of all non-null input values, or null if none\n   "],
            ['bool_and(expression)  RETURNS bool', "true if all input values are true, otherwise false\n   "],
            ['bool_or(expression)  RETURNS bool', "true if at least one input value is true, otherwise false\n   "],
            ['count(*)  RETURNS bigint', "number of input rows\n   "],
            ['count(expression)  RETURNS bigint', "number of input rows for which the value of expression is not null\n   "],
            ['every(expression)  RETURNS bool', "equivalent to bool_and\n   "],
            ['json_agg(expression)  RETURNS json', "aggregates values as a JSON array\n   "],
            ['jsonb_agg(expression)  RETURNS jsonb', "aggregates values as a JSON array\n   "],
            ['json_object_agg(name, value)  RETURNS json', "aggregates name/value pairs as a JSON object\n   "],
            ['jsonb_object_agg(name, value)  RETURNS jsonb', "aggregates name/value pairs as a JSON object\n   "],
            ['max(expression)  RETURNS same as argument type', "maximum value of expression across all input values\n   "],
            ['min(expression)  RETURNS same as argument type', "minimum value of expression across all input values\n   "],
            ['string_agg(expression, delimiter)  RETURNS same as argument types', "input values concatenated into a string, separated by delimiter\n   "],
            ['sum(expression)  RETURNS bigint for smallint or int arguments, numeric for bigint arguments, otherwise the same as the argument data type', "sum of expression across all input values\n   "],
            ['xmlagg(expression)  RETURNS xml', "concatenation of XML values (see also Section 9.14.1.7)\n   "],
            ['mode() WITHIN GROUP (ORDER BY sort_expression)  RETURNS same as sort expression', "returns the most frequent input value (arbitrarily choosing the first one if there are multiple equally-frequent results)\n   "],
            ['percentile_cont(fraction) WITHIN GROUP (ORDER BY sort_expression)  RETURNS same as sort expression', "continuous percentile: returns a value corresponding to the specified fraction in the ordering, interpolating between adjacent input items if needed\n   "],
            ['percentile_cont(fractions) WITHIN GROUP (ORDER BY sort_expression)  RETURNS array of sort expression\'s type', "multiple continuous percentile: returns an array of results matching the shape of the fractions parameter, with each non-null element replaced by the value corresponding to that percentile\n   "],
            ['percentile_disc(fraction) WITHIN GROUP (ORDER BY sort_expression)  RETURNS same as sort expression', "discrete percentile: returns the first input value whose position in the ordering equals or exceeds the specified fraction\n   "],
            ['percentile_disc(fractions) WITHIN GROUP (ORDER BY sort_expression)  RETURNS array of sort expression\'s type', "multiple discrete percentile: returns an array of results matching the shape of the fractions parameter, with each non-null element replaced by the input value corresponding to that percentile\n   "],
            ['rank(args) WITHIN GROUP (ORDER BY sorted_args)  RETURNS bigint', "rank of the hypothetical row, with gaps for duplicate rows\n   "],
            ['dense_rank(args) WITHIN GROUP (ORDER BY sorted_args)  RETURNS bigint', "rank of the hypothetical row, without gaps\n   "],
            ['percent_rank(args) WITHIN GROUP (ORDER BY sorted_args)  RETURNS double precision', "relative rank of the hypothetical row, ranging from 0 to 1\n   "],
            ['cume_dist(args) WITHIN GROUP (ORDER BY sorted_args)  RETURNS double precision', "relative rank of the hypothetical row, ranging from 1/N to 1\n   "],
            ['GROUPING(args...)  RETURNS integer', "Integer bit mask indicating which arguments are not being included in the current grouping set\n   "],
            ['row_number()  RETURNS bigint', "number of the current row within its partition, counting from 1\n   "],
            ['rank()  RETURNS bigint', "rank of the current row with gaps; same as row_number of its first peer\n   "],
            ['dense_rank()  RETURNS bigint', "rank of the current row without gaps; this function counts peer groups\n   "],
            ['percent_rank()  RETURNS double precision', "relative rank of the current row: (rank - 1) / (total rows - 1)\n   "],
            ['cume_dist()  RETURNS double precision', "relative rank of the current row: (number of rows preceding or peer with current row) / (total rows)\n   "],
            ['ntile(num_buckets integer)  RETURNS integer', "integer ranging from 1 to the argument value, dividing the partition as equally as possible\n   "],
            ['lag(value anyelement [, offset integer [, default anyelement ]])  RETURNS same type as value', "returns value evaluated at the row that is offset rows before the current row within the partition; if there is no such row, instead return default (which must be of the same type as value). Both offset and default are evaluated with respect to the current row. If omitted, offset defaults to 1 and default to null\n   "],
            ['lead(value anyelement [, offset integer [, default anyelement ]])  RETURNS same type as value', "returns value evaluated at the row that is offset rows after the current row within the partition; if there is no such row, instead return default (which must be of the same type as value). Both offset and default are evaluated with respect to the current row. If omitted, offset defaults to 1 and default to null\n   "],
            ['first_value(value any)  RETURNS same type as value', "returns value evaluated at the row that is the first row of the window frame\n   "],
            ['last_value(value any)  RETURNS same type as value', "returns value evaluated at the row that is the last row of the window frame\n   "],
            ['nth_value(value any, nth integer)  RETURNS same type as value', "returns value evaluated at the row that is the nth row of the window frame (counting from 1); null if no such row\n   "],
            ['generate_subscripts(array anyarray, dim int)  RETURNS setof int', "Generate a series comprising the given array's subscripts.\n   "],
            ['generate_subscripts(array anyarray, dim int, reverse boolean)  RETURNS setof int', "Generate a series comprising the given array's subscripts. When reverse is true, the series is returned in reverse order.\n   "],
            ['generate_series(start, stop)  RETURNS setof int, setof bigint, or setof numeric same as argument type', "Generate a series of values, from start to stop with a step size of one\n   "],
            ['generate_series(start, stop, step)  RETURNS setof int, setof bigint or setof numeric same as argument type', "Generate a series of values, from start to stop with a step size of step\n   "],
            ['generate_series(start, stop, step interval)  RETURNS setof timestamp or setof timestamp with time zone same as argument type', "Generate a series of values, from start to stop with a step size of step\n   "],
            [' pg_event_trigger_table_rewrite_oid() RETURNS Oid', "The OID of the table about to be rewritten.\n   "],
            [' pg_event_trigger_table_rewrite_reason() RETURNS int', "The reason code(s) explaining the reason for rewriting. The exact meaning of the codes is release dependent.\n   "]
        ];
    };
    return FunctionsInfoDb;
})();
exports.FunctionsInfoDb = FunctionsInfoDb;
//# sourceMappingURL=signatureHelpProvider.js.map