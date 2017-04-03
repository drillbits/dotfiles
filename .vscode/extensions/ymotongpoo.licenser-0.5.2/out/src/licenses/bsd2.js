//    Copyright 2016 Yoshi Yamaguchi
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
"use strict";
var BSD2 = (function () {
    function BSD2(author) {
        this.author = author;
        var date = new Date();
        this.year = date.getFullYear().toString();
    }
    BSD2.prototype.termsAndConditions = function () {
        var template = "Simplified BSD License\n======================\n\n*Copyright (c) " + this.year + ", " + this.author + "*\n*All rights reserved.*\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are met: \n\n1. Redistributions of source code must retain the above copyright notice, this\n   list of conditions and the following disclaimer. \n2. Redistributions in binary form must reproduce the above copyright notice,\n   this list of conditions and the following disclaimer in the documentation\n   and/or other materials provided with the distribution. \n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\" AND\nANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED\nWARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\nDISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR\nANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES\n(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;\nLOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND\nON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS\nSOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n\nThe views and conclusions contained in the software and documentation are those\nof the authors and should not be interpreted as representing official policies, \neither expressed or implied, of the FreeBSD Project.";
        return template;
    };
    BSD2.prototype.header = function () {
        var template = "Copyright " + this.year + " " + this.author + ". All rights reserved.\nUse of this source code is governed by a BSD-style\nlicense that can be found in the LICENSE file.";
        return template;
    };
    return BSD2;
}());
exports.BSD2 = BSD2;
//# sourceMappingURL=bsd2.js.map