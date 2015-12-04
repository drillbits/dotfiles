"""commands to support generalized Driessen's branching model
"""
# License GPL 2.0
#
# hgflow.py - Mercurial extension to support generalized Driessen's branching model
# Copyright (C) 2011-2014, Yujie Wu and others
#
# This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2 of the License or any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
# of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.


    
import os
import sys
import copy
import difflib
import mercurial

from mercurial import util, extensions, error, config
from mercurial.node import short
from mercurial.i18n import _



###############################################################################################################################
# Let's use 128 char width.
# It is silly to stick to the 80-char rule.
#
#
# Terminologies  <== Read before you got confused
#   - branch type
#     We distinguish the following types of branches: master, develop, feature, release, hotfix, support.
#     We should assume any branch is of one of these types.
#
#   - stream
#     The entire set of branches of the same type. Stream is not branch, it is a set. Stream is not a type, it is a set.
#     Stream is a set of branches.
#
#   - substream
#     A subset of branches in a stream.
#
#   - trunk
#     Trunk is a special branch. A stream can optionally have a trunk, but only one trunk at most. For example, master and
#     develop streams each has a trunk, whereas feature, release, hotfix, and support streams don't.
#     If a stream has a trunk, all branches in the stream normally should diverge from the trunk and later merge to the trunk
#     when the branches are closed.
#     Trunk is a relative concept. A trunk of a stream may be a regular branch of another stream. (The former stream will be
#     a substream of the latter.)
#
#   - source
#     Source is an attribute of stream. The source of a stream refers to the parent stream where branches in the current stream
#     are created from. Most commonly, source of a stream is the stream itself. But this is not always the case, for example,
#     the sources of release and feature streams are the develop stream.
#
#   - destin
#     Destin is another attribute of stream. The destin of a stream refers to the stream(s) where branches in the current
#     stream will merge to. Most commonly, destin of a stream is the stream itself. But this is not always the case, for
#     example, the destin of release is the develop and the master streams.
#
#   - branch name
#     Use this term carefully since it is potentially ambiguious.
#     Try using this term to refer to fullname (see below).
#
#   - fullname
#     Branch name as recognized by the SCM, e.g., feature/enhance_log.
#     Prefer this term to 'branch name'.
#
#   - basename
#     Branch name recognized by flow, but not necessarily by SCM, e.g., enhanced_log (with prefix 'feature/' dropped).
#
#   - name
#     Use this term carefully since it is potentially ambiguious.
#     This term should be a synonym of basename (see above). Try using it only as place holders, such as
#     <hotfix-prefix>/<name>.
#
#   - flow action
#     Refer to action on a specified stream, e.g., hg flow feature start, where 'start' is an action.
#
#   - flow command
#     Refer to other actions than those on a stream, e.g., hg flow unshelve, where 'unshelve' is a command.
#
#   - hg command
#     Refer to command not from flow extension.
#
#   - workflow
#     Refer to the process of executing a sequence of hg commands.
#
#   - history
#     Refer to a sequence of hg commands that has been executed.
#
# Notations
#   - <stream>
#     Examples: <feature>, <hotfix>. These denote the corresponding streams. When you refer to a stream, e.g., feature stream,
#     use '<feature>' (or more verbosely 'feature stream'), instead of '<feature> stream', because '<feature>' already means
#     stream.
#
#   - <stream> branch
#     Example: a <feature> branch. This phrase refers a branch in <feature>. Do not use 'a feature branch' to mean a branch in
#     <feature> because the word 'feature' there should take its usual meaning as in English, which doesn't necessarily mean
#     the feature stream.
#
#   - `text`
#     Example, `hg flow feature start <name>`. The text wrapped by the ` (apostrophe) symbols should be a piece of code or
#     shell command, which could contain placeholders to be replaced by actual values.
#
#   - 'text' or "text"
#     Refer to an exact string.
###############################################################################################################################



VERSION                   = "0.9.8"
CONFIG_BASENAME           = ".hgflow"
OLD_CONFIG_BASENAME       = ".flow"
CONFIG_SECTION_BRANCHNAME = "branchname"
STRIP_CHARS               = '\'"'


colortable = {"flow.error"      : "red bold",
              "flow.warn"       : "magenta bold",
              "flow.note"       : "cyan",
              "flow.help.topic" : "yellow",
              "flow.help.code"  : "green bold",
              }



def _print( ui, *arg, **kwarg ) :
    """
    Customized print function

    This function prints messages with the prefix: C{flow: }. Multiple messages can be printed in one call.
    See I{Example I} below.

    @type  ui:      C{mercurial.ui}
    @param ui:      Mercurial user interface object
    @type  warning: C{bool}
    @param warning: If set to true, messages will be written to C{stderr} using the C{ui.warn} function.
    @type  note:    C{bool}
    @param note:    If set to true, messages will be written to C{stdout} using the C{ui.note} function. The messages will be
                    visible only when user turns on C{--verbose}.
                    By default, both L{warning} and L{note} are set to false, and messages will be written to C{stdout}.
    @type  prefix:  C{None} or C{str}
    @param prefix:  Add a customized prefix before every message. See I{Example II}.
    @type  newline: C{bool}
    @param newline: If set to false, each message will be written without newline suffix. Default value is true.

    I{Example I}:
    
    >>> _print( ui, "message1", "message2" )
    flow: message1
    flow: message2

    I{Example II}:
    
    >>> _print( ui, "message1", "message2", prefix = "warning: " )
    flow: warning: message1
    flow: warning: message2

    I{Example III}:
    
    >>> _print( ui, "message1", "message2", inline = False )
    flow: message1message2
    """
    printer = ui.warn if (kwarg.get( "warning" )) else (ui.note if (kwarg.get( "note" )) else ui.write)
    indent  = kwarg.get( "indent", "" )
    prefix  = kwarg.get( "prefix", "" )
    newline = kwarg.get( "newline" )
    newline = "\n" if (newline or newline is None) else ""
    for e in arg :
        printer( ui.config( "flow", "prefix", "flow: " ).strip( STRIP_CHARS ) + prefix + indent )
        printer( e + newline, label = kwarg.get( "label", "" ) )



def _warn( ui, *arg, **kwarg ) :
    """
    Print messages to C{stderr}. Each message will be prefixed with C{flow: warning: }.

    This function is a thin wrapper of L{_print}. See document of the later for usage detail.
    
    Customized prefix will be appended after C{flow: warning: }.

    I{Example}:

    >>> _warn( ui, "message1", "message2", prefix = "prefix_" )
    flow: warning: prefix_message1
    flow: warning: prefix_message2
    """
    kwarg["warn"  ] = True
    kwarg["label" ] = kwarg.get( "label", "flow.warn" )
    kwarg["prefix"] = "warning: " + kwarg.get( "prefix", "" )
    _print( ui, *arg, **kwarg )



def _error( ui, *arg, **kwarg ) :
    """
    Print messages to C{stderr}. Each message will be prefixed with C{flow: error: }.

    This function is a thin wrapper of L{_print}. See document of the later for usage detail.
    
    Customized prefix will be appended after C{flow: error: }.

    I{Example}:

    >>> _error( ui, "message1", "message2", prefix = "prefix_" )
    flow: error: prefix_message1
    flow: error: prefix_message2
    """
    kwarg["warn"  ] = True
    kwarg["label" ] = kwarg.get( "label", "flow.error" )
    kwarg["prefix"] = "error: " + kwarg.get( "prefix", "" )
    _print( ui, *arg, **kwarg )



def _note( ui, *arg, **kwarg ) :
    """
    Print messages to C{stout}. Each message will be prefixed with C{flow: note: }. The messages will be displayed only when
    user turns on C{--verbose}. If you want to print message without C{--verbose}, include an argument C{via_quiet = True} in
    the call to this function.

    This function is a thin wrapper of L{_print}. See document of the later for usage detail.
    
    Customized prefix will be appended after C{flow: note: }.

    I{Example}:

    >>> _note( ui, "message1", "message2", prefix = "prefix_" )
    flow: note: prefix_message1
    flow: note: prefix_message2
    """
    if (kwarg.get( "via_quiet")) :
        kwarg["note"] = not kwarg["via_quiet"]
        del kwarg["via_quiet"]
    else :
        kwarg["note"] = True
    kwarg["label" ] = kwarg.get( "label", "flow.note" )
    kwarg["prefix"] = "note: " + kwarg.get( "prefix", "" )
    _print( ui, *arg, **kwarg )



class AbortFlow( Exception ) :
    """
    Throw an instance of this exception whenever we have to abort the flow command.
    """
    def __init__( self, *arg, **kwarg ) :
        """
        Accept one or more error messages in C{str} as the arguments.
        """
        Exception.__init__( self, "Aborted hg flow command." )
        self._msg = arg
        for k in kwarg :
            self.__dict__[k] = kwarg[k]



    def error_message( self ) :
        """
        Returns a list of error messages in C{str}.
        """
        return self._msg
    


class AbnormalStream( Exception ) :
    """
    Throw an instance of this exception if the stream does not belong to any one of C{<master>}, C{<develop>}, C{<feature>},
    C{<release>}, C{<hotfix>}, and C{<support>}.
    """
    def __init__( self, message = "", stream = None ) :
        """
        Accept one error message. You can also pass the C{Stream} object, which can be retrieved later via the C{stream}
        method.
        """
        Exception.__init__( self, message )
        self._stream = stream



    def stream( self ) :
        """
        Return the C{Stream} object.
        """
        return self._stream

        

class Commands( object ) :
    """
    Wrapper class of C{mercurial.commands} with ability of recording command history.

    I{Example:}

    >>> commands = Commands()
    >>> commands.commit( ui, repo, ... )
    >>> commands.update( ui, repo, ... )
    >>> commands.print_history()
    flow: note: Hg command history:
    flow: note:   hg commit --message "flow: Closed release 0.7." --close_branch
    flow: note:   hg update default
    """

    def __init__( self ) :
        self.ui           = None
        self._cmd         = None
        self._cmd_history = []
        self._via_quiet   = False
        self._dryrun      = False
        self._common_opts = {}
        self._opt_mutator = {}

        self.reg_option_mutator( "strip", lambda opts : dict( {"rev" : [],},                                 **opts ) )
        self.reg_option_mutator( "graft", lambda opts : dict( {"rev" : [], "continue" : False,},             **opts ) )
        self.reg_option_mutator( "log",   lambda opts : dict( {"date" : None, "user" : None, "rev" : None,}, **opts ) )

        
    
    def __getattr__( self, name ) :
        """
        Typical invocation of mercurial commands is in the form: commands.name( ... ).
        We only need to save the command name here, leaving execution of the command to the L{__call__} function.
        """
        if (name[0] != "_") :
            self._cmd = name
            return self

        

    def __call__( self, ui, repo, *arg, **kwarg ) :
        """
        Invoke the mercurial command and save it as a string into the history.
        
        @raise AbortFlow: Throw exception if the return code of hg command (except C{commit} and C{rebase}) is nonzero.
        """
        self.ui = ui
        cmd_str = "hg " + (self._cmd[:-1] if (self._cmd[-1] == "_") else self._cmd)
        arg     = self._branch2str(   arg )
        kwarg   = self._branch2str( kwarg )
        cmd     = self._cmd

        if (cmd[0] == "q") :
            where = extensions.find( "mq" )
            cmd   = cmd[1:]
        elif (cmd == "strip" ) : where = extensions.find( "mq"     )
        elif (cmd == "rebase") : where = extensions.find( "rebase" )
        else                   : where = mercurial.commands

        kwarg = self._mutate_options( where, self._cmd, kwarg )

        for key, value in sorted( kwarg.items(), reverse = True ) :
            if (value in [None, "", False]) :
                continue
            
            # If the command is `hg commit --message <commit-hint> --force-editor [other-options...]`, we will drop the
            # `--message <commit-hint> --force-editor` part from the command string because `--force-editor` is not a command
            # option (it avails only programmatically).
            if (cmd == "commit" and (key in ["message", "force_editor",]) and "force_editor" in kwarg) :
                continue
            
            new_key = ""
            for e in key :
                new_key += "-" if (e == "_") else e
            key   = new_key
            value = [self._add_quotes( e ) for e in value] if (isinstance( value, list )) else self._add_quotes( value )
                
            if (isinstance( value, bool )) :
                cmd_str = "%s --%s" % (cmd_str, key,)
            elif (isinstance( value, list )) :
                for e in value :
                    cmd_str = "%s --%s %s" % (cmd_str, key, str( e ),)
            else :
                cmd_str = "%s --%s %s" % (cmd_str, key, str( value ),)
        for e in arg :
            cmd_str = '%s %s ' % (cmd_str, self._add_quotes( str( e ) ),)
            
        self._cmd_history.append( cmd_str )
        
        if (self._dryrun) :
            return
        
        try :
            # Ever since 2.8 the "strip" command has been moved out of the "mq" module to a new module of its own. Issue#56
            if ("strip" == cmd) :
                from mercurial import __version__
                if (__version__.version > "2.8") :
                    where = extensions.find( "strip" )
                    cmd   = "stripcmd"

            ret = None
            ret = getattr( where, cmd )( ui, repo, *arg, **kwarg )
        except Exception, e :
            raise AbortFlow( "Hg command failed: %s" % cmd_str, "abort: %s\n" % str( e ), traceback = sys.exc_info() )
        
        if (ret and cmd not in ["commit", "rebase",]) :
            # We have to make some exceptions, where nonzero return codes don't mean error. Issue#55
            if ((ret, cmd,) not in [(1, "push",),]) :
                raise AbortFlow( "Hg command failed: %s" % cmd_str, "abort: Nonzero return code from hg command\n" )



    def _add_quotes( self, value ) :
        """
        If C{value} is a string that contains space, slash, double quote, and parenthesis (viz: '(' or ')'), wrap it with
        double quotes and properly escape the double-quotes and slashes within, and finally return the modified string.
        Otherwise, return the value as is.        
        """
        if (isinstance( value, str ) and (1 in [c in value for c in " ()\\\""])) :
             new_value = ""
             for c in value :
                 if   (c == "\\") : new_value += "\\\\"
                 elif (c == '"' ) : new_value += "\""
                 else             : new_value += c
             value = '"%s"' % new_value
        return value

        

    def _branch2str( self, value ) :
        """
        If C{value} is a C{Branch} object, return its fullname (C{str}); if it is not, return the object itself. Do this
        recursively if C{value} is a C{tuple}, or C{list}, or C{dict} object.
        """
        if (isinstance( value, Branch )) :
            return value.fullname()
        if (isinstance( value, (list, tuple,) )) :
            new_value = []
            for e in value :
                new_value.append( self._branch2str( e ) )
            return new_value
        if (isinstance( value, dict )) :
            new_value = {}
            for k, v in value.items() :
                new_value[k] = self._branch2str( v )
            return new_value
        return value
    


    def _filter_common_options( self, where, cmd ) :
        """
        If any common options are valid options of the command, return these options.

        @type  where: module
        @param where: Should be `mercurial.commands', or a Mercurial's plugin object.
        @type  cmd  : C{str}
        @param cmd  : Mercurial command name
        """
        ret = {}
        if (self._common_opts != {}) :
            if (cmd[-1] == "_") :
                cmd = cmd[:-1]
            junk, table = mercurial.cmdutil.findcmd( cmd, where.table if hasattr( where, "table" ) else where.cmdtable )
            opts        = [e[1] for e in table[1]]
            for e in self._common_opts :
                if (e in opts) :
                    ret[e] = self._common_opts[e]
        return ret

    

    def _mutate_options( self, where, cmd, opts ) :
        """
        Call the registered command option mutator for the command and return the modified command options.
        
        @type  where: module
        @param where: Should be `mercurial.commands', or a Mercurial's plugin object.
        @type  cmd  : C{str}
        @param cmd  : Mercurial command name
        @type  opts : C{dict}
        @param opts : Original command options
        
        @rtype: C{dict}
        """
        common_opts = self._filter_common_options( where, cmd )
        common_opts.update( opts )
        opts    = common_opts
        mutator = self._opt_mutator.get( cmd )
        if (mutator) :
            opts = mutator( opts )

        return opts

        

    def use_quiet_channel( self, via_quiet = True ) :
        """
        Print the history to the I{quiet} channel, where text will be displayed even when user does not specify the
        C{--verbose} option.

        @type  via_quiet: C{bool}
        @param via_quiet: To turn off using the "quiet" channel for history printing, you can call this function like:
                          C{use_quiet_channel( False )}.
        """
        self._via_quiet = via_quiet



    def use_verbose_channel( self, via_verbose = True ) :
        """
        Print the history to the I{verbose} channel, where text will be display only when user specify the C{--verbose} option.

        @type  via_verbose: C{bool}
        @param via_verbose: To turn off using the "verbose" channel for history printing (you will be using the "quiet"
                            channel instead), you can call this function like: C{use_verbose_channel( False )}.
        """
        self._via_quiet = not via_verbose



    def reg_common_options( self, opts ) :
        """
        Register common options.

        @type  opts: C{dict}
        @param opts: Common options. Key = option's flag, value = option's value. 
        """
        self._common_opts.update( opts )



    def reg_option_mutator( self, cmd, mutator ) :
        """
        Register common options.

        @type  cmd    : C{str}
        @param cmd    : Mercurial command name
        @type  mutator: Callable object
        @param mutator: It will take a C{dict} object as its argument and return another C{dict} object that is supposed to be
                        a mutant of the former. The input object is supposed to be the original hg-command options in form of
                        key-value pairs.
        """
        self._opt_mutator[cmd] = mutator



    def dryrun( self, switch = None ) :
        """
        Switch the dry-run mode.

        @type  switch: C{boolean} or C{None}
        @param switch: Switch on dry-run mode if C{switch = True}, off if C{switch = False}. If C{switch} is C{None}, just
                       return the current state of dry-run mode.
        """
        if (switch is None) :
            return self._dryrun
        self._dryrun = switch
        

            
    def print_history( self ) :
        """
        Print the command history using the L{_note} function.
        """
        if (self.ui) :
            _note( self.ui, "Hg command history:", via_quiet = self._via_quiet )
            for e in self._cmd_history :
                _note( self.ui, e, prefix = "  ", via_quiet = self._via_quiet )



class Stream( object ) :
    @staticmethod
    def gen( ui, repo, name, check = False ) :
        """
        Given the name of a stream, return a C{Stream} object.
        If the name is that of one of the standard streams: master, develop, feature, release, hotfix, and support, return the
        same object as in C{STREAM}. If not, create and return a new C{stream} object. If the new object is not in the standard
        streams, an C{AbnormalStream} exception will be thrown. One can catch the exception and call its C{stream} method to
        get the object.
        
        @type  name : C{str}
        @param name : Name of the stream. It can be a complex stream name, e.g., "develop/spring:release".
        @type  check: C{boolean}
        @param check: If true and the stream is not a standard one, the function will check if the trunk of the stream exists
                      or not and (if exists) open or not.
                      
        @raise AbortFlow     : When C{check} is true and the trunk of the stream doesn't exist or is closed
        @raise AbnormalStream: When the stream is not in any of the standard streams
        """
        source = None
        tokens = name.split( ':' )
        n      = len( tokens )
        if (n == 2) :
            source, name = tokens[0], tokens[1]
        if (n > 2 or not name) :
            raise AbortFlow( "Invalid stream syntax: '%s'" % stream )

        for e in STREAM.values() :
            if (name == e.name()) :
                if (source) :
                    stream = copy.copy( e )
                    break
                else :
                    return e
        else :
            rootstream_name = name.split( '/', 1 )[0]
            is_normalstream = True

            if (rootstream_name in STREAM) :
                trunk  = name.replace( rootstream_name + '/', STREAM[rootstream_name].prefix(), 1 )
                stream = Stream( ui, repo, name, trunk = trunk )
            else :
                stream = Stream( ui, repo, name, trunk = name )
                is_normalstream = False
                
            if (check) :
                try :
                    trunk = stream.trunk()
                except error.RepoLookupError , e :
                    misspelling = difflib.get_close_matches( stream.name(), STREAM.keys(), 3, 0.7 )
                    note        = "Did you mean: %s?" % " or ".join( misspelling ) if (misspelling) else None
                    raise AbortFlow( "Stream not found: %s" % stream, note = note )
                if (trunk.is_closed()) :
                    raise AbortFlow( "%s has been closed." % stream )

        # It seems we never really mind abnormal streams. So comment this out.
        #if (not is_normalstream) :
        #    raise AbnormalStream( stream = Stream( ui, repo, name ) )

        if (source) :
            source = Stream.gen( ui, repo, source, check = True )
            stream = copy.copy( stream )
            stream._source = source
            for i, e in enumerate( stream.destin() ) :
                if (source in e) :
                    stream._destin[i] = source
                    break
            else :
                stream._destin = [source]

        return stream

        

    def __init__( self, ui, repo, name, **kwarg ) :
        """
        Create a new C{Stream} object.

        @type  name  : C{str}
        @param name  : Name of the new stream
        @type  trunk : C{str} or C{None}
        @param trunk : Fullname of the trunk of the stream, or C{None}
        @type  prefix: C{str}
        @param prefix: Name prefix of branches in this stream. If not specified, it will default to C{trunk + '/'} (if C{trunk}
                       is not C{None}), or C{name + '/'} if (C{trunk} is C{None}).
        @type  source: C{Stream}
        @param source: Stream where branches in this stream will be created from
        @type  destin: C{list} of C{Stream} objects
        @param destin: Streams where branches in this stream will merge to when being finished
        """
        self.ui   = ui
        self.repo = repo
        
        self._name   = name
        self._trunk  = kwarg.get( "trunk"  )
        self._prefix = kwarg.get( "prefix" )
        self._source = kwarg.get( "source", self )
        self._destin = kwarg.get( "destin", [self._source,] )
        self._tcache = None    # Caches `Branch' object of the trunk because construction of a `Branch' object is very slow.
        
        if (self._prefix is None) :
            if (self._trunk) :
                self._prefix = self._trunk + '/'
            else :
                self._prefix = self._name + '/'
        
        
        
    def __str__( self ) :
        """
        Return a string: '<stream-name>'.
        """
        return "<%s>" % self._name



    def __cmp__( self, rhs ) :
        """
        Compare streams by comparing their names as strings.
        """
        lhs = self._name
        rhs = rhs ._name
        return -1 if (lhs < rhs) else (1 if (lhs > rhs) else 0)



    def __contains__( self, stranch ) :
        """
        Return true if the C{stanch} is in this stream.
        
        @type  stranch: C{Stream} or C{Branch}
        @param srranch: Stream or branch which you want to test if it is in this stream
        """
        if (isinstance( stranch, Branch )) :
            if (stranch._fullname == self._trunk) :
                return True
            return stranch._fullname.startswith( self.prefix() )
        elif (isinstance( stranch, Stream )) :
            return stranch.prefix().startswith( self.prefix() )
        return str( stranch ).startswith( self.prefix() )

    
    
    def name( self ) :
        """
        Return the name of this stream.
        """
        return self._name



    def trunk( self, trace = False ) :
        """
        Return the trunk of this stream. If it has no trunk, return C{None} or the trunk of the source stream depending on the
        C{trace} parameter.

        @type  trace: C{boolean}
        @param trace: If true and this stream has no trunk, return the trunk of the source stream, and do this recursively
                      until a trunk is found. If false and this stream has no trunk, this function will return C{None}.
                      
        @return: A C{Branch} object or C{None}
        """
        if (self._tcache) :
            return self._tcache

        trunk = Branch( self.ui, self.repo, self._trunk ) if (self._trunk) else None
        if (not trunk and trace) :
            return self.source().trunk( True )
        self._tcache = trunk
        return trunk
    


    def prefix( self ) :
        """
        Return the branch name prefix of this stream.

        @return: C{str}
        """
        return self._prefix



    def source( self ) :
        """
        Return the source stream.

        @return: C{Stream}
        """
        return self._source



    def destin( self ) :
        """
        Return a list of streams where branches in this stream will merge to when finished.

        @return: C{Stream}
        """
        return self._destin

    

    def get_fullname( self, branch_basename ) :
        """
        Return the fullname of a branch.

        @type  branch_basename: C{str}
        @param branch_basename: Basename of a branch in this stream

        @return: C{str}
        """
        return self._prefix + branch_basename



    def get_branch( self, branch_basename ) :
        """
        Create and return a new C{Branch} object with the given basename.

        @type  branch_basename: C{str}
        @param branch_basename: Basename of a branch in this stream
        
        @return: C{Branch}
        """
        return Branch( self.ui, self.repo, self.get_fullname( branch_basename ) )

    

    def branches( self, openclosed = "open" ) :
        """
        Return a list of branches in this stream. The list does not include the trunk.
        The returned list is sorted per branch name.

        @type  openclosed: C{str}, must be one of "open", "closed", and "all".
        @param openclosed: If the value is C{"open"}, return all open branches in this stream; if C{"closed"}, return all
                           closed branches in this stream; if C{"all"}, returns all open and closed branches in this stream.
        """
        if (openclosed not in ["open", "closed", "all",]) :
            raise ValueError( "Invalid value for `openclosed` parameter: %s" % openclosed )

        all_branches = []
        if (openclosed == "open") :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads
                                 if (not self.repo[head].extra().get( "close", False ))]
        elif (openclosed == "closed") :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads
                                 if (self.repo[head].extra().get( "close", False ))]
        else :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads]

        return sorted( [e for e in all_branches if (e in self)] )
        
    

class Branch( object ) :
    def __init__( self, ui, repo, rev = None ) :
        """
        Create a C{Branch} object with the given C{rev}.
        """
        self.ui   = ui
        self.repo = repo
        self.ctx  = repo[rev]    # `repo[rev]' is slow when there are tens of thousands of named branches.
        
        self._fullname = str( self.ctx.branch() )

        

    def __str__( self ) :
        """
        Return the fullname of this branch.
        """
        return self._fullname



    def __cmp__( self, rhs ) :
        """
        Compare two C{Branch} object by comparing their fullnames.
        """
        if (rhs is None) :
            return 1
        lhs = self._fullname
        rhs = rhs ._fullname
        return -1 if (lhs < rhs) else (1 if (lhs > rhs) else 0)

    
    
    def fullname( self ) :
        """
        Return the fullname of this branch.
        """
        return self._fullname

    

    def basename( self, stream = None, should_quote = False ) :
        """
        Return the basename relative to the C{stream}. If C{stream} is C{None}, return the shortest possible basename (will
        not contain any '/'s).
        Return the string "trunk" if this branch is the trunk of the C{stream}.

        @type        stream: C{Stream} or C{None}
        @param       stream: Stream to which the basename is relative
        @type  should_quote: C{bool}
        @param should_quote: The returned string will be wrapped with single quotes ' if this parameter's value is true.
        """
        if (stream) :
            if (self._fullname == stream._trunk) :
                return "trunk"
            ret = self._fullname[len( stream.prefix() ):]
        else :
            ret = self._fullname.rsplit( '/', 1 )[-1]
        if (should_quote) :
            ret = "'%s'" % ret
        return ret


    
    def rev_node( self ) :
        """
        Return a string showing this branch's head's revision number and short node ID in the format of "<rev>:<node-ID>",
        e.g., "9:db14bf692069".
        """
        return "%s:%s" % (self.ctx.rev(), short( self.ctx.node() ),)



    def is_closed( self ) :
        """
        Return true if this branch is closed; or false if it is open.
        """
        extra = self.ctx.extra()
        try :
            return extra["close"]
        except KeyError :
            return False



    def is_open( self ) :
        """
        Return true if this branch is open; or false if it is closed.
        """
        return not self.is_closed()



    def is_develop_trunk( self ) :
        """
        Return true if this branch is the trunk of C{<develop>}.
        """
        return STREAM["develop"]._trunk == self._fullname



    def is_master_trunk( self ) :
        """
        Return true if this branch is the trunk of C{<master>}.
        """
        return STREAM["master"]._trunk == self._fullname



    def is_trunk( self, stream ) :
        """
        Return true if this branch is the trunk of the C{stream}.
        """
        return stream._trunk == self._fullname
    
    
        
    def stream( self ) :
        """
        Return the stream that this branch belongs to.
        """
        name = self._fullname
        for stream in STREAM.values() :
            if (name == stream._trunk) :
                return stream
            if (name.startswith( stream.prefix() )) :
                name = name.replace( stream.prefix(), stream.name() + '/' )
                break
        return Stream.gen( self.ui, self.repo, name.rsplit( '/', 1 )[0] )



commands = Commands()
STREAM   = {}           # key = stream name, value = `Stream` object. Will be set by `Flow.__init__`.



class Flow( object ) :

    ACTION_NAME = ["start", "finish", "push", "publish", "pull", "list", "log", "abort", "promote", "rebase", "rename",]

    def __init__( self, ui, repo, init = False ) :
        """
        Construct a C{Flow} instance that will execute the workflow.
        Construction will fail if the C{flow} extension has not been initialized for the repository.
        A warning message will be issued if the repository has uncommitted changes.
        
        @type  init: C{boolean}
        @param init: If true, a C{Flow} object will be constructed for initialization of hgflow. Such constructed object does
                     not supply all functionalities and is only meant to execute the `hg flow init` command.
        """
        self.ui   = ui
        self.repo = repo

        self.autoshelve       = False
        self.warn_uncommitted = True
        self.msg_prefix       = "flow: "
        self.version_prefix   = "v"
        self.orig_workspace   = Branch( ui, repo )
        self.curr_workspace   = self.orig_workspace     # May be changed whenever `hg update` command is executed.
        self.orig_dir         = os.getcwd()
        self._dryrun_shelve   = set()
        
        if (init) : return
        
        config_fname = os.path.join( self.repo.root, CONFIG_BASENAME )
        if (os.path.isfile( config_fname )) :
            cfg = config.config()
            cfg.read( config_fname )
            try :
                master  = cfg.get( CONFIG_SECTION_BRANCHNAME, "master"  )
                develop = cfg.get( CONFIG_SECTION_BRANCHNAME, "develop" )
                feature = cfg.get( CONFIG_SECTION_BRANCHNAME, "feature" )
                release = cfg.get( CONFIG_SECTION_BRANCHNAME, "release" )
                hotfix  = cfg.get( CONFIG_SECTION_BRANCHNAME, "hotfix"  )
                support = cfg.get( CONFIG_SECTION_BRANCHNAME, "support" )
            except Exception, e :
                self._error( str( e ) )
                self._error( "Flow has not been initialized properly for this repository." )
                self._note ( "You can use command `hg flow init -f` to reinitialize for this repository.", via_quiet = True )
                sys.exit( 1 )
        else :
            old_config_fname = os.path.join( self.repo.root, OLD_CONFIG_BASENAME )
            if (os.path.isfile( old_config_fname )) :
                cfg = config.config()
                cfg.read( old_config_fname )
                try :
                    master  = cfg.get( CONFIG_SECTION_BRANCHNAME, "master"  )
                    develop = cfg.get( CONFIG_SECTION_BRANCHNAME, "develop" )
                    feature = cfg.get( CONFIG_SECTION_BRANCHNAME, "feature" )
                    release = cfg.get( CONFIG_SECTION_BRANCHNAME, "release" )
                    hotfix  = cfg.get( CONFIG_SECTION_BRANCHNAME, "hotfix"  )
                    support = cfg.get( CONFIG_SECTION_BRANCHNAME, "support" )
                except Exception, e :
                    self._error( str( e ) )
                    self._error( "Flow has not been initialized properly for this repository." )
                    self._note ( "You can use command `hg flow init -f` to reinitialize for this repository.",
                                 via_quiet = True )
                    sys.exit( 1 )
            else :
                self._error( "Flow has not been initialized for this repository: %s file is missing." % CONFIG_BASENAME )
                self._note ( "You can use command `hg flow init` to initialize for this repository.", via_quiet = True )
                sys.exit( 1 )

        global STREAM
        STREAM["master" ] = Stream( ui, repo, "master",  trunk  = master  )
        STREAM["develop"] = Stream( ui, repo, "develop", trunk  = develop )
        STREAM["feature"] = Stream( ui, repo, "feature", prefix = feature, source = STREAM["develop"] )
        STREAM["release"] = Stream( ui, repo, "release", prefix = release, source = STREAM["develop"] )
        STREAM["hotfix" ] = Stream( ui, repo, "hotfix",  prefix = hotfix,  source = STREAM["master" ] )
        STREAM["support"] = Stream( ui, repo, "support", prefix = support, source = STREAM["master" ], destin = [] )

        STREAM["develop"]._destin.append( STREAM["release"] )
        STREAM["release"]._destin.append( STREAM["master" ] )
        STREAM["hotfix" ]._destin.append( STREAM["develop"] )

        if (ui.has_section( "hgflow" )) :
            self._warn( "The [hgflow] section in hg configuration file is deprecated." )
            self._warn( "Please replace the section name from [hgflow] to [flow]." )
            self.autoshelve       = ui.configbool( "hgflow", "autoshelve",       self.autoshelve        )
            self.warn_uncommitted = ui.configbool( "hgflow", "warn_uncommitted", self.warn_uncommitted  )
        if (ui.has_section( "flow" )) :
            self.autoshelve       = ui.configbool( "flow", "autoshelve",       self.autoshelve       )
            self.warn_uncommitted = ui.configbool( "flow", "warn_uncommitted", self.warn_uncommitted )
            self.msg_prefix       = ui.config    ( "flow", "prefix",           self.msg_prefix       ).strip( STRIP_CHARS )
            self.version_prefix   = ui.config    ( "flow", "version_prefix",   self.version_prefix   ).strip( STRIP_CHARS )
        if (self._has_uncommitted_changes() and self.warn_uncommitted) :
            self._warn( "Your workspace has uncommitted changes." )

        # We'd better temporarily change the current directory to the root of the repository at the beginning.
        # This is to avoid the problem that the CWD might be gone after switching to a different branch. (Issue#14)
        # We will change it back to the original directory when the hgflow command exits.
        os.chdir( self.repo.root )
        # __init__
    
    
    
    def __getattr__( self, name ) :
        """
        Execute mercurial command of name C{name[1:]}.

        @type  name: C{str}
        @param name: Should be a mercurial command name prefixed with one underscore. For example, to call C{commit} command,
                     use C{self._commit}.
        """
        if (name[0] == "_") :
            cmd = getattr( commands, name[1:] )
            def func( *arg, **kwarg ) :
                cmd( self.ui, self.repo, *arg, **kwarg )
            return func
        raise AttributeError( "%s instance has no attribute '%s'" % (self.__class__, name,) )



    def _update( self, rev, *arg, **kwarg ) :
        """
        Intercept the call to `hg update` command. We need to keep track of the branch of the workspace.

        @type  rev: C{str} or C{mercurial.changectx}
        @param rev: Revision to which the workspace will update
        """
        try :
            old_workspace_ctx   = self.curr_workspace.ctx
            self.curr_workspace = rev if (isinstance( rev, Branch )) else Branch( self.ui, self.repo, rev )
        except error.RepoLookupError, e :
            if (commands.dryrun()) :
                commands.update( self.ui, self.repo, rev, *arg, **kwarg )
            else :
                raise e
        
        if (old_workspace_ctx != self.curr_workspace.ctx) :
            commands.update( self.ui, self.repo, rev, *arg, **kwarg )
        
        

    def _print( self, *arg, **kwarg ) :
        """
        Thin wrapper of the global C{_print} function
        """
        _print( self.ui, *arg, **kwarg )

        

    def _warn( self, *arg, **kwarg ) :
        """
        Thin wrapper of the global C{_warn} function
        """
        _warn( self.ui, *arg, **kwarg )

        

    def _error( self, *arg, **kwarg ) :
        """
        Thin wrapper of the global C{_error} function
        """
        _error( self.ui, *arg, **kwarg )



    def _note( self, *arg, **kwarg ) :
        """
        Thin wrapper of the global C{_note} function
        """
        _note( self.ui, *arg, **kwarg )



    def _check_rebase( self ) :
        """
        Check if 'rebase' extension is activated. If not, raise an 'AbortFlow' exception.

        @raise AbortFlow: When 'rebase' extension is not found
        """
        try :
            extensions.find( "rebase" )
        except KeyError :
            raise AbortFlow( "Cannot rebase without 'rebase' extension." )

        

    def _check_mq( self ) :
        """
        Check if 'mq' extension is activated. If not, raise an 'AbortFlow' exception.
        
        @raise AbortFlow: When 'mq' extension is not found
        """
        try :
            extensions.find( "mq" )
        except KeyError :
            raise AbortFlow( "Cannot shelve/unshelve changes without 'mq' extension." )

        

    def _check_strip( self ) :
        """
        The 'strip' command comes with the 'mq' extension.
        Check if 'mq' extension is activated. If not, raise an 'AbortFlow' exception.
        
        @raise AbortFlow: When 'mq' extension is not found
        """
        try :
            extensions.find( "mq" )
        except KeyError :
            raise AbortFlow( "Cannot use 'strip' command without 'mq' extension." )
            


    def _is_shelved( self, branch ) :
        """
        Return true if the given branch has been shelved.

        @type  branch: C{Branch}
        @param branch: Branch to test if it has shelved changes
        """
        shelve_name = "flow/" + branch.fullname() + ".pch"
        patch_fname = self.repo.join( "patches/" + shelve_name )
        return os.path.isfile( patch_fname )
 
            
        
    def _shelve( self, *arg, **kwarg ) :
        """
        Shelve workspace if C{self.autoshelve} is C{True}.

        This function utilizes the C{mq} extension to achieve shelving. Bascially, it calls the following C{mq} commands:
            C{hg qnew <patchname> --currentuser --currentdate -m "Shelved changes"}
            C{hg qpop}
        where <patchname> follows the pattern: flow/<branch_fullname>.pch
        The two commands will give us a patch file that later will be used to unshelve the change.
        """
        if (self.autoshelve or kwarg.get( "force" )) :
            if (self._has_uncommitted_changes()) :
                shelve_name = "flow/" + self.curr_workspace.fullname() + ".pch"
                if (commands.dryrun()) :
                    # For dry run, adds the name of the shelved item into `self._dryrun_shelve'.
                    # This is for generating correct dry run history for the unshelving operation.
                    self._dryrun_shelve.add( shelve_name )
                self._check_mq()
                self._qnew( shelve_name, currentuser = True, currentdate = True, message = "Shelved changes" )
                self._qpop()



    def _unshelve( self, basename = None, **kwarg ) :
        """
        Unshelve the previously shelved changes to the workspace if C{self.autoshelve} is C{True}.

        This function needs the C{mq} extension to achieve unshelving. Bascially, it calls the following commands:
            C{hg import <patch_filename> --no-commit}
            C{hg qdelete <patchname>}
        where <patchname> follows the pattern: flow/<branch_fullname>.pch, which was previously created by flow's shelving.

        @type  basename: C{str}
        @param basename: Basename of the path of the shelved patch file. Default is the name of current workspace branch.
        """
        if (self.autoshelve or kwarg.get( "force" )) :
            basename    = basename if (basename) else self.curr_workspace.fullname()
            shelve_name = "flow/" + basename + ".pch"
            patch_fname = self.repo.join( "patches/" + shelve_name )
            if (os.path.isfile( patch_fname ) or (shelve_name in self._dryrun_shelve)) :
                self._check_mq()
                self._import_( patch_fname, no_commit = True, base = "", strip = 1 )
                self._qdelete( shelve_name )
                if (commands.dryrun()) :
                    self._dryrun_shelve.discard( shelve_name )
                    
    
        
    def _has_uncommitted_changes( self ) :
        """
        Return true if any tracked file is modified, or added, or removed, or deleted.
        """
        return any( self.repo.status() )

    

    def _branches( self, openclosed = "open" ) :
        """
        Return a list of branches.
        
        @type  openclosed: C{str}, "open", "closed", and "all"
        @param openclosed: If C{"open"}, return all open branches; if C{"closed"}, return all closed branches; if C{"all"},
                           return all branches.
        """
        if (openclosed not in ["open", "closed", "all",]) :
            raise ValueError( "Invalid value for openclosed parameter: %s" % openclosed )

        all_branches = []
        if (openclosed == "open") :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads
                                 if (not self.repo[head].extra().get( "close", False ))]
        elif (openclosed == "closed") :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads
                                 if (self.repo[head].extra().get( "close", False ))]
        else :
            for branch_fullname, heads in self.repo.branchmap().items() :
                all_branches += [Branch( self.ui, self.repo, head ) for head in heads]

        return all_branches



    def _find_branch( self, fullname ) :
        """
        Try to find a branch of name: C{fullname}. If it exists, return a C{Branch} object of this branch and a boolean value
        indicating if it's open (C{True}) or closed (C{False}). If it does not exists, return C{(None, None)}.

        @type  fullname: C{str}
        @param fullname: Fullname of the branch to find
        """
        try :
            branch = Branch( self.ui, self.repo, fullname )
            return branch, branch.is_open()
        except error.RepoLookupError :
            return None, None

    
    
    def latest_master_tags( self ) :
        """
        Return the latest tag of C{<master>} branch.
        """
        trunk          = STREAM["master"].trunk()
        trunk_fullname = trunk.fullname()
        master_context = trunk.ctx
        while (master_context) :
            tags = master_context.tags()
            try :
                tags.remove( "tip" )
            except ValueError :
                pass
            if (tags) :
                return tags
            parents        = master_context.parents()
            master_context = None
            for e in parents :
                if (trunk_fullname == e.branch()) :
                    master_context = e
                    break
        return []

    

    def _create_branch( self, fullname, message, from_branch = None, **kwarg ) :
        """
        Create a new branch and commit the change.

        @type     fullname: C{str}
        @param    fullname: Fullname of the new branch
        @type      message: C{str}
        @param     message: Commit message
        @type  from_branch: C{Branch}
        @param from_branch: Parent branch of the new branch
        """
        if (from_branch and self.curr_workspace != from_branch) :
            self._update( from_branch )
        self._branch( fullname )
        self._commit( message = message, **kwarg )
        if (commands.dryrun()) :
            # Makes a fake new branch.
            self.curr_workspace = Branch( self.ui, self.repo )
            self.curr_workspace._fullname = fullname
        else :
            self.curr_workspace = Branch( self.ui, self.repo, fullname )
        
        

    def _action_start( self, stream, *arg, **kwarg ) :
        """
        Conduct the I{start} action for the given stream. A new branch in the stream will be created.

        @type  stream: C{Stream}
        @param stream: Stream where you want to start a new branch
        """
        try :
            basename = arg[1]
        except IndexError :
            raise AbortFlow( "You must specify a name for the new branch to start." )
            
        rev         = kwarg.pop( "rev",     None )
        msg         = kwarg.pop( "message", ""   )
        dirty       = kwarg.pop( "dirty",   None )
        fullname    = stream.get_fullname( basename )
        br, is_open = self._find_branch( fullname )
        if (br) :
            self._error( "A branch named '%s' already exists in %s: '%s'." % (basename, stream, fullname,) )
            if (not is_open) :
                self._note( "Branch '%s' is currently closed." % fullname, via_quiet = True )
        else :
            shelvedpatch_basename = self.curr_workspace.fullname()
            if (rev is None) :
                from_branch = stream.source().trunk()
                self._shelve( force = dirty )
                self._update( from_branch )
            else :
                from_branch = Branch( self.ui, self.repo, rev )
                if (from_branch._fullname != stream.source()._trunk) :
                    raise AbortFlow( "Revision %s is not in the source stream of %s." % (rev, stream,) )
                self._shelve( force = dirty )
                self._update( rev = rev )
            if (msg) :
                msg = "%s\n" % msg
            self._create_branch( fullname, "%s%sCreated branch '%s'." % (msg, self.msg_prefix, fullname,), **kwarg )
            if (dirty) :
                self._unshelve( shelvedpatch_basename, force = dirty )

            

    def _action_push( self, stream, *arg, **kwarg ) :
        """
        Conduct the I{push} action for the given stream. The workspace branch will be pushed to the remote repository.

        @type  stream: C{Stream}
        @param stream: Stream where you want to push the workspace branch
        """
        if (self.curr_workspace in stream) :
            self._push( new_branch = True, branch = [self.curr_workspace.fullname(),] )
        else :
            raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (self.curr_workspace, stream,),
                             "To push a %s branch, you must first update to it." % stream )
        
        

    def _action_pull( self, stream, *arg, **kwarg ) :
        """
        Conduct the I{pull} action for the given stream. The workspace branch will be updated with changes pulled from the
        remote repository.

        @type  stream: C{Stream}
        @param stream: Stream where you want to pull for the workspace branch
        """
        try :
            branch = stream.get_fullname( arg[1] )
        except IndexError :
            branch = self.curr_workspace
            if (branch not in stream) :
                raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (branch, stream,),
                                 "To pull a %s branch, you must first update to it." % stream )
                
        self._pull( update = True, branch = [branch,] )
        


    def _action_list( self, stream, *arg, **kwarg ) :
        """
        Print all open branches in the given stream.

        @type  stream: C{Stream}
        @param stream: Stream of which you want to display open branches
        """
        # Lists all open branches in this stream.
        open_branches = stream.branches()
        trunk         = stream.trunk()
        if (trunk) :
            tags = ""
            if (stream == STREAM["master"]) :
                tags = self.latest_master_tags()
                tags = (", latest tags: %s" % ", ".join( tags )) if (tags) else ""
            self._print( "%s trunk: %s%s" % (stream, trunk, tags,) )
        if (open_branches) :
            self._print( "Open %s branches:" % stream )
            for e in open_branches :
                marker  = "#" if (self._is_shelved( e )   ) else ""
                marker += "*" if (e == self.curr_workspace) else ""
                marker += "  %s" % e.rev_node()
                self._print( str( e ) + marker, prefix = "  " )
        else :
            self._print( "No open %s branches" % stream )
        if (kwarg.get( "closed" )) :
            closed_branches = stream.branches( "closed" )
            if (closed_branches) :
                self._print( "Closed %s branches:" % stream )
                closed_branches.sort( lambda x, y : y.ctx.rev() - x.ctx.rev() )
                for e in closed_branches :
                    self.ui.write( "%-31s" % e.basename( stream ), label = "branches.closed" )
                    self.ui.write( " %18s" % e.rev_node(),         label = "log.changeset"   )
                    self.ui.write( "  %s\n"  % util.datestr( e.ctx.date(), format = "%Y-%m-%d %a %H:%M %1" ),
                                   label = "log.date" )
                    bn = str( e )
                    p1 = e.ctx
                    while (p1.branch() == bn) :
                        e  = p1
                        p1 = e.p1()
                    description = e.description()
                    msg_prefix  = ("flow: ", "hgflow: ", "hg flow,", self.msg_prefix or "#@$(&*^$",)
                    if (not (description.startswith( msg_prefix ))) :
                        lines = [e.strip() for e in description.split( "\n" )]
                        self.ui.note( "  description: %s\n" % lines[0] )
                        for line in lines[1:] :
                            if (not (line.startswith( msg_prefix ))) :
                                self.ui.note( "               %s\n" % lines[0] )
                        self.ui.note( "\n" )
            else :
                self._print( "No closed %s branches" % stream )



    def _action_log( self, stream, *arg, **kwarg ) :
        """
        Show revision history of the specified branch.

        @type  stream: C{Stream},
        @param stream: Stream where the specified branch is
        """
        # User may specify a file with a relative path name. Since CWD has changed to the repository's root dir when the
        # `Flow' object was constructed, we need to restore the original dir to get the correct path name of the file.
        os.chdir( self.orig_dir )
        filenames = kwarg.pop( "file", [] )
        onstream  = kwarg.pop( "onstream", False )
        closed    = kwarg.pop( "closed",   False )
        if (onstream) :
            filenames.extend( arg[1:] )
            branches = stream.branches( "all" if (closed) else "open" )
            if (stream._trunk) :
                branches.append( stream._trunk )
        else :
            # Case 1: hg flow <stream> log <basename>
            #         - Shows the log of the "<stream>/<basename>" branch.
            # Case 2: hg flow <stream> log
            #         - Case 2a: <stream> does not have a trunk
            #                    - Shows the log of the current workspace, which should be a branch in <stream>.
            #         - Case 2b: <stream> has a trunk
            #                    - Case 2b1: Current workspace is a branch in <stream>.
            #                                - Shows the log of the current workspace.
            #                    - Case 2b2: Current workspace is not a branch in <stream>.
            #                                - Shows the log of <stream>'s trunk.
            # Case 3: hg flow <stream> log <filename>
            #         - This case can be overriden by Case 1. Namely, if the <filename> happens to be the same as the
            #           <basename>, the latter will take precedence.
            #         - Case 3a: The current workspace is in <stream>
            #                    - Show the log of <filename> in the current workspace branch.
            #         - Case 3b: The current workspace is not in <stream>, and <stream> has a trunk.
            #                    - Show the log of <filename> in <stream>'s trunk.
            #         - Case 3c: The current workspace is not in <stream>, and <stream> has no trunk.
            #                    - Error
            try :
                branch = stream.get_branch( arg[1] )
                # Case 1
            except error.RepoLookupError :
                filenames.append( arg[1] )
                if (self.curr_workspace in stream) :
                    # Case 3a
                    branch = self.curr_workspace
                else :
                    branch = stream.trunk()
                    if (not branch) :
                        # Case 3c
                        raise AbortFlow( "Cannot determine branch in %s. Please be more specific." % stream )
                    else :
                        # Case 3b
                        # Just be clear that we have covered Case 2b2.
                        pass
            except IndexError :
                branch = stream.trunk()
                if (not branch) :
                    # Case 2a
                    branch = self.curr_workspace
                    if (branch not in stream) :
                        raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (branch, stream,),
                                         "To show log of a %s branch, you must also specify its name." % stream )
                elif (self.curr_workspace in stream) :
                    # Case 2b1
                    branch = self.curr_workspace
                else :
                    # Case 2b2
                    # Just be clear that we have covered Case 2b2.
                    pass
            # At this point, `branch` must be existent.
            branches = [branch,]

        opts = {"branch" : branches,}
        opts.update( kwarg )
        self._log( *filenames, **opts )

        

    def _action_abort( self, stream, *arg, **kwarg ) :
        """
        Abort the workspace branch.

        @type  stream: C{Stream}
        @param stream: Stream where the branch which you want to abort is
        """
        arg            = arg[1:]
        msg            = kwarg.pop( "message",  ""    )
        should_erase   = kwarg.pop( "erase",    False )
        onstream       = kwarg.pop( "onstream", False )
        curr_workspace = self.curr_workspace
        if (msg) :
            msg = "%s\n" % msg
        if (curr_workspace.is_develop_trunk()) :
            raise AbortFlow( "You cannot abort the <develop> trunk." )
        if (arg) :
            if (len( arg ) > 1 or curr_workspace.basename() != arg[0]) :
                raise AbortFlow( "hgflow intentionally forbids aborting a non-workspace branch." )
        if (onstream) :
            branches = stream.branches()
            if (stream == STREAM["develop"]) :
                branches.remove( stream.trunk() )
            elif (stream._trunk) :
                branches.append( stream.trunk() )
            for branch in branches :
                if (should_erase) :
                    self._strip( branch, self.repo.revs( "min(branch('%s'))" % branch )[0] )
                else :
                    self._update( branch )
                    self._commit( close_branch = True, message = "%s%sAborted %s %s." %
                                  (msg, self.msg_prefix, stream, branch.basename( stream, should_quote = True ),) )
            if (self.curr_workspace != self.orig_workspace and self._orig_workspace not in branches) :
                self._update( self.orig_workspace )
        else :
            if (curr_workspace.is_trunk( stream )) :
                curr_stream = curr_workspace.stream()
                raise AbortFlow( "You cannot abort a trunk.",
                                 "To abort '%s' as a branch, use `hg flow %s abort`." % (curr_workspace, curr_stream.name(),)
                                 )
            if (curr_workspace not in stream) :
                raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (curr_workspace, stream,),
                                 "To abort a %s branch, you must first update to it." % stream )
            if (should_erase) :
                self._strip( curr_workspace, self.repo.revs( "min(branch('%s'))" % curr_workspace )[0] )
            else :
                self._commit( close_branch = True, message = "%s%sAborted %s '%s'." %
                              (msg, self.msg_prefix, stream, curr_workspace.basename( stream ),) )
            self._update( stream.trunk( trace = True ) )
        self._unshelve()

    

    def _action_promote( self, stream, *arg, **kwarg ) :
        """
        Promote the workspace branch to its destination stream(s). If there are uncommitted changes in the current branch,
        they will be automatically shelved before rebasing and unshelved afterwards.

        @type  stream: C{Stream}
        @param stream: Stream where the branch which you want to rebase is
        @type  rev   : C{str}
        @param rev   : If provided, promote this revision instead of the head. The specified revision must be in the workspace
                       branch.
        """
        rev            = kwarg.pop( "rev",     None )
        tag_name       = kwarg.pop( "tag",     None )
        message        = kwarg.pop( "message", None )
        message        = (message + "\n") if (message) else ""
        orig_workspace = self.curr_workspace
        has_shelved    = False
        
        if (orig_workspace not in stream) :
            raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (orig_workspace, stream,),
                             "To promote a %s branch, you must first update to it." % stream )
        
        if (rev) :
            # Ensures `rev` is in workspace branch.
            promoted_branch = Branch( self.ui, self.repo, rev )
            promoted_rev    = rev
            promoted_node   = promoted_branch.ctx.node()
            if (promoted_branch != orig_workspace) :
                raise AbortFlow( "Revision %s is not in workspace branch." % rev )
        else :
            promoted_branch = orig_workspace
            promoted_rev    = orig_workspace
            promoted_ctx    = promoted_branch.ctx
            promoted_node   = promoted_ctx.node()
            # `promoted_node' is `None' if the `promote_ctx' is an instance of `workingctx'.
            while (promoted_node is None) :
                promoted_ctx  = promoted_ctx._parents[0]
                promoted_node = promoted_ctx.node()
            
        if (arg[1:]) :
            if (not has_shelved) :
                self._shelve()
                has_shelved = True
            for dest in arg[1:] :
                self._update( dest          )
                self._merge ( promoted_rev  )
                self._commit( message = message + ("%sPromoted %s '%s' (%s) to '%s'." %
                              (self.msg_prefix, stream, promoted_branch.basename( stream ),
                               short( promoted_node ), dest,)), **kwarg )
                if (tag_name) :
                    self._tag( tag_name, **kwarg )
        else :
            destin = [STREAM["master"],] if (STREAM["develop"] == stream) else stream.destin()
            for s in destin :
                if (s == stream) :
                    continue
                trunk = s.trunk()
                if (trunk) :
                    if (not has_shelved) :
                        self._shelve()
                        has_shelved = True
                    self._update( trunk        )
                    self._merge ( promoted_rev )
                    self._commit( message = message + ("%sPromoted %s '%s' (%s) to '%s'." %
                                  (self.msg_prefix, stream, promoted_branch.basename( stream ),
                                   short( promoted_node ), trunk,)), **kwarg )
                    if (tag_name) :
                        self._tag( tag_name, **kwarg )
                else :
                    self._error( "Cannot determine promote destination." )
                    return
        if (orig_workspace != self.curr_workspace) :
            self._update( orig_workspace )
        self._unshelve()

    

    def _action_rebase( self, stream, *arg, **kwarg ) :
        """
        Rebase the workspace branch to its parent branch. If there are uncommitted changes in the current branch, they will be
        automatically shelved before rebasing and unshelved afterwards.

        @type  stream: C{Stream}
        @param stream: Stream where the branch which you want to rebase is
        @type  dest  : C{str}
        @param dest  : If provided, use its value as the destination of rebasing. The value must be a changeset of the parent
                       branch, otherwise it will trigger an error. If not provided, use the tip of the parent branch as the
                       destination of rebasing.
        """
        dest     = kwarg.get( "dest" )
        onstream = kwarg.pop( "onstream", False )
        if (onstream) :
            if (not dest) :
                dest = stream.source().trunk( trace = True )
            branches = stream.branches()
            if (stream == STREAM["develop"]) :
                branches.remove( stream.trunk() )
            elif (stream._trunk) :
                branches.append( stream.trunk() )
            self._check_rebase()
            self._shelve()
            for branch in branches :
                if (dest != branch) :
                    self._rebase( base = branch, dest = dest, keepbranches = True )
            self._unshelve()
        else :
            curr_workspace = self.curr_workspace
            if (not dest) :
                dest = stream.trunk( trace = True )
            if (curr_workspace not in stream) :
                raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (curr_workspace, stream,),
                                 "To rebase a %s branch, you must first update to it." % stream )
            if (curr_workspace.is_develop_trunk()) :
                raise AbortFlow( "You cannot rebase the <develop> trunk." )
            if (dest == curr_workspace) :
                self._warn( "No effects from rebasing a branch to itself" )
            else :
                self._check_rebase()
                self._shelve()
                self._rebase( base = curr_workspace, dest = dest, keepbranches = True )
                self._unshelve()



    def _action_rename( self, stream, *arg, **kwarg ) :
        """
        Rename the workspace branch to a new basename. If there are uncommitted changes in the current branch, they will be
        automatically shelved before renaming and unshelved afterwards.
        Under the hood this action will create a new branch and copy (or graft) all commits in the workspace branch to the new
        branch and then erase the workspace branch.

        @type  stream: C{Stream}
        @param stream: Stream where the branch which you want to rename is
        @type  to    : C{str}
        @param to    : Its value should be the new basename of the workspace branch.
        """
        new_branch_name = kwarg.pop( "to", None )
        curr_workspace  = self.curr_workspace
        if (not new_branch_name) :
            raise AbortFlow( "Please specify the new base name of this branch via the `-t` option." )
        if (curr_workspace not in stream) :
            raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (curr_workspace, stream,),
                             "To rename a %s branch, you must first update to it." % stream )
        if (curr_workspace.is_trunk( stream )) :
            raise AbortFlow( "You cannot rename the trunk of %s." % stream )
        if (new_branch_name == curr_workspace.basename( stream )) :
            self._warn( "No effects because the supposed new basename turns out to be the same as the current one." )
        else :
            cfn = curr_workspace.fullname()
            brn = "branch(%s)" % cfn
            rev = "min(%s)" % brn
            ctx = self.repo[self.repo.revs( rev )[0]]
            nfn = stream.get_fullname( new_branch_name )
            msg = ctx.description()
            msg = msg.replace( cfn, nfn )
            self._shelve()
            self._update( self.repo.revs( "%s^" % rev )[0] )
            self._create_branch( nfn, msg, user = ctx.user(), date = util.datestr( ctx.date() ) )
            self._graft( curr_workspace, **kwarg )
            self._unshelve( cfn )
            self._strip( curr_workspace, int( ctx ) )
    
    
    
    def _update_workspace( self, stream, branch, verbose = True ) :
        """
        Update the workspace to the given branch. Shelving and unshelving will be conducted automatically.

        @type  stream: C{Stream}
        @param stream: Stream where the branch which you are updating the workspace to is
        @type  branch: C{Branch} or C{None}
        @param branch: Branch to update the workspace to. No effects if it is C{None}.
        """
        if (not branch) :
            return
        
        if (branch == self.curr_workspace) :
            if (verbose) :
                self._print( "You are already in %s %s." % (stream, branch.basename( stream, should_quote = True ),) )
        else :
            self._print( "Update workspace to %s %s." % (stream, branch.basename( stream, should_quote = True ),) )
            self._shelve()
            self._update( branch )
            self._unshelve()
        self._print( "Parent of working directory: %s" % branch.rev_node() )


    
    def _action_other( self, stream, *arg, **kwarg ) :
        """
        If the action is the name of a branch in the given stream, we will update workspace to that branch; otherwise, the
        action is considered as an error.
        
        @type  stream: C{Stream}
        @param stream: Stream where the branch that we will switch to is
        """
        try :
            name   = arg[0]
            branch = stream.get_branch( name )
            if (branch.is_closed()) :
                self._warn( "%s '%s' has been closed." % (stream, name,) )
            self._update_workspace( stream, branch )
        except error.RepoLookupError :
            misspelling = difflib.get_close_matches( name, Flow.ACTION_NAME, 3, 0.7 )
            note = ("Did you mean: %s?" % " or ".join( misspelling )) if (misspelling    ) else None
            note = ("Did you mean: finish or abort?")                 if ("close" == name) else note
            if (stream != STREAM["master"]) :
                note = ("If you meant to create a new branch called '%s' in %s" % (name, stream,),
                        "try command:", "  hg flow %s start %s" % (stream.name(), name,),) if (not note) else note
            raise AbortFlow( "Invalid action or unknown branch in %s: '%s'" % (stream, name,), note = note )

            

    def _commit_change( self, opt, commit_hint, is_erasing = False ) :
        """
        Commit the changes in the workspace.
        Note that this method can potentially mutate C{opt}. Specifically, it will delete the C{commit} and C{message} keys if
        they present in C{opt}.
        
        @type  opt: C{dict}
        @param opt: Option dictionary. Recognizable keys are C{commit} and C{message}. The value of C{commit} should be a
                    boolean, indicating whether or not to perform committing. The value of C{message} should be a string, which
                    will be used as the commit message. It is OK for both of the options to be missing. But it would trigger
                    an error if C{message} is given without C{commit} set to true. There is no special treatment on other
                    keys, and they will be passed to the C{hg commit} command as is.
                    
        @rtype : C{bool}
        @return: Return `True' if committing was successfully done, or `False' if it was not.
        """
        if (opt.get( "commit" )) :
            del opt["commit"]
            msg = opt.get( "message" )
            if (msg is None) :
                opt["force_editor"] = True
                opt["message"] = "\n\nHG: flow: %s" % commit_hint
            self._commit( **opt )
            del opt["message"]
            if (msg is None) :
                del opt["force_editor"]
            return True
        elif (opt.get( "message" )) :
            if (is_erasing) :
                del opt["message"]
            else :
                raise AbortFlow( "Cannot use the specified commit message.", "Did you forget to specify the -c option?" )
        return False
    
        
            
    def _action_finish( self, stream, *arg, **kwarg ) :
        """
        Finish a branch in the given stream. The current workspace must be in the branch to be finished, otherwise an error
        will be triggered. The default behavior of finish action is the following:
          1. close the branch.
          2. merge the branch to the C{destin} streams.

        @type  stream: C{Stream}
        @param stream: Stream where the branch that we will finish is
        """
        try :
            tag_name = arg[1]
            self._warn( "You just specified the <tag-name> using the deprecated syntax:" )
            self._warn( "  hg flow <stream> finish <tag-name> [<options>]" )
            self._warn( "Try using the new syntax to do that in the future: hg flow <stream> finish -t <tag-name>" )
            self._warn( "Note that hgflow intentionally forbids finishing a non-workspace branch." )
        except IndexError :
            tag_name = None

        message        = kwarg.get( "message",  None  )
        tag_name       = kwarg.pop( "tag",      tag_name )
        onstream       = kwarg.pop( "onstream", False )
        should_erase   = kwarg.pop( "erase",    False )
        curr_workspace = self.curr_workspace
        curr_stream    = curr_workspace.stream()
        name           = curr_workspace.basename( stream, should_quote = True )
        tag_name_orig  = tag_name
        tag_name       = tag_name if (tag_name) else (self.version_prefix + name[1:-1])
        develop_stream = STREAM["develop"]

        if (should_erase) :
            if (onstream       ) : raise AbortFlow( "'--erase' cannot be used together with '--onstream'." )
            if (message is None) : raise AbortFlow( "'--message' is required when '--erase' is used." )
            self._check_strip()
            
        if (onstream) :
            if (stream in [develop_stream, STREAM["support"], STREAM["hotfix"], STREAM["release"],]) :
                raise AbortFlow( "You cannot finish %s." % stream )
            branches = stream.branches()
            if (stream._trunk) :
                substream = Stream.gen( self.ui, self.repo, stream.name() )
                for branch in branches :
                    self._update( branch )
                    self._action_finish( substream, *arg, **kwarg )
                self._update( stream.trunk() )
                self._action_finish( stream, *arg, **kwarg )
            else :
                for branch in branches :
                    self._update( branch )
                    self._action_finish( stream, *arg, **kwarg )
            return
                
        if (curr_workspace.is_develop_trunk()) :
            raise AbortFlow( "You cannot finish the <develop> trunk." )
        elif (curr_workspace not in stream) :
            raise AbortFlow( "Your workspace is '%s' branch, which is not in %s." % (curr_workspace, stream,),
                             "To finish a %s branch, you must first update to it." % stream )

        # Merges the workspace to its `destin` streams.
        destin_with_trunk    = []
        destin_without_trunk = []
        final_branch         = None
        for s in stream.destin() :
            trunk = s.trunk()
            if (trunk == curr_workspace) :
                pass
            elif (trunk) :
                destin_with_trunk.append( s )
            else :
                destin_without_trunk.append( s )

        if (should_erase) :
            if (len( destin_with_trunk + destin_without_trunk ) > 1) :
                raise AbortFlow( "'--erase' cannot be applied to branches with multiple merge destinations." )
        
        # Commits changes (if any) in the current branch.
        is_commit_done = self._commit_change( kwarg, "Finishing '%s' branch" % curr_workspace, should_erase )

        # If the commit was done successfully, we don't check against uncommitted changes.
        # This is particularly needed for dry run.
        if (not is_commit_done and self._has_uncommitted_changes()) :
            raise AbortFlow( "Cannot finish '%s' branch because it has uncommitted changes." % curr_workspace )
        
        # For destin streams without trunks, we need to create a branch in each of these destin streams.
        # Each newly created branch will be from the current branch and named after the pattern:
        # <stream-prefix>/<current-branch-basename>. Afterwards, the current branch will be closed.
        # Note that there is no need to merge the current branch because the new branch is created from it.
        for s in destin_without_trunk :
            trunk    = s.trunk()
            so_name  = "" if ("trunk" == curr_workspace.basename( stream )) else ("/" + curr_workspace.basename( stream ))
            so       = Stream    ( self.ui, self.repo, stream.name() + so_name, trunk = curr_workspace.fullname() )
            so       = Stream.gen( self.ui, self.repo, "%s:%s" % (so.name(), s.name(),), check = True )
            basename = curr_workspace.basename()
            self.action( so, "start", basename )
            final_branch = s.get_fullname( basename )
            
        if (destin_with_trunk or destin_without_trunk) :
            # If either list is not empty.
            self._update( curr_workspace )
            self._commit( close_branch = True, message = "%sClosed %s %s." % (self.msg_prefix, stream, name,), **kwarg )
        else :
            # If both lists are empty.
            if (stream == STREAM["support"]) :
                self._update( curr_workspace )
                self._commit( close_branch = True, message = "%sClosed %s %s." % (self.msg_prefix, stream, name,), **kwarg )
                final_branch = STREAM["master"].trunk()
            else :
                self._print( "All open branches in %s are finished and merged to its trunk." % stream )

        if (tag_name_orig and (STREAM["master"] not in destin_with_trunk)) :
            self._warn( "You specified a tag name, but it has effect only when the workspace branch is merged to <master>." )
                
        for s in destin_with_trunk :
            trunk = s.trunk()
            self._update( trunk          )
            self._merge ( curr_workspace )
            self._commit( message = "%sMerged %s %s to %s ('%s')." % (self.msg_prefix, stream, name, s, trunk,), **kwarg )
            if (s == STREAM["master"]) :
                self._tag( tag_name, force = True )
            elif (s in develop_stream and s is not develop_stream) :
                tr_stream = trunk.stream()
                for ss in tr_stream.destin() :
                    if (ss == develop_stream) :
                        dvtrunk = develop_stream.trunk()
                        tr_name = trunk.basename( ss )
                        self._update( dvtrunk )
                        self._merge ( trunk   )
                        self._commit( message = "%sMerged <develop/%s:%s> %s to %s ('%s')." %
                                      (self.msg_prefix, tr_name, stream.name(), name, ss, dvtrunk,), **kwarg )
        if (final_branch) :
            self._update( final_branch )
        if (should_erase) :
            rev = "p1(.)"
            rev = mercurial.scmutil.revsingle( self.repo, rev ).rev()
            self._update( "tip" )
            self._update( rev   )
            self._revert( rev = "-1", all = True )
            self._strip ( curr_workspace, self.repo.revs( "min(branch('%s'))" % curr_workspace )[0] )
            self._commit( message = message, **kwarg )
        self._unshelve()
            
            

    def _execute_action( self, stream, *arg, **kwarg ) :
        """
        Execute an action on the given stream. If no action is specified, the action will default to I{list}
        (see L{_action_list}). The default behavior of an action is defined by the C{_action_*} methods. Custom action behavior
        can be given through the C{action_func} parameter.

        @type  stream:      C{Stream}
        @param stream:      Stream where we will execute the action
        @type  action_func: C{dict}
        @param action_func: Custom action methods. Key (C{str}) is action name, and value is a function that define the
                            behavior of the custom action.
        """
        try :
            action = arg[0]
        except IndexError :
            action = "list"

        action_func = {
            "start"   : self._action_start,
            "finish"  : self._action_finish,
            "push"    : self._action_push,
            "publish" : self._action_push,
            "pull"    : self._action_pull,
            "list"    : self._action_list,
            "log"     : self._action_log,
            "abort"   : self._action_abort,
            "promote" : self._action_promote,
            "rebase"  : self._action_rebase,
            "rename"  : self._action_rename,
            "other"   : self._action_other,
        }

        custom_action_func = kwarg.pop( "action_func", {} )
        action_func.update( custom_action_func )

        return action_func.get( action, self._action_other )( stream, *arg, **kwarg )
    
    
       
    def action( self, stream, *arg, **kwarg ) :
        """
        Execute action on the stream.

        @type  stream: C{Stream}
        @param stream: Stream where we will execute the action
        """
        if (len( arg ) > 0) :
            action = arg[0]
            if (stream == STREAM["master"]) :
                if (action in ["start", "finish", "abort", "rebase",]) :
                    raise AbortFlow( "Invalid action for <master>" )
        else :
            trunk = stream.trunk()
            self._update_workspace( stream, trunk, verbose = False )
        self._execute_action( stream, *arg, **kwarg )
        
    

    def print_version( self, *arg, **kwarg ) :
        """
        Print flow's version and then quit.
        """
        self._print( "version %s" % VERSION )



    def unshelve( self, *arg, **kwarg ) :
        """
        Unshelve the previously shelved changes.
        """
        self.autoshelve = True
        self._unshelve( *arg, **kwarg )

        

    def print_open_branches( self, *arg, **kwarg ) :
        """
        Print open branches in each stream.

        The currently active branch will be marked with a * symbol. Branches where there are shelved changes will be marked
        with a # symbol.
        """
        self._print( "Currently open branches:" )
        curr_workspace = self.curr_workspace
        stream_names   = ["master", "develop", "feature", "release", "hotfix", "support",]
        all_branches   = self._branches()
        name_branches  = {}
        for branch in all_branches :
            name_branches.setdefault( branch.fullname(), [] ).append( branch )
        name_branches = sorted( name_branches.items() )
        for sn in stream_names :
            stream = STREAM[sn]
            trunk  = stream.trunk()
            open_branches_in_stream = []
            for name, heads in name_branches :
                e = heads[0]
                if (e in stream) :
                    open_branches_in_stream.append( e )
            if (trunk is None and not open_branches_in_stream) :
                continue
            self._print( "%-9s: " % stream, newline = False )
            if (trunk) :
                marker  = "#" if (self._is_shelved( trunk )) else ""
                marker += "*" if (trunk == curr_workspace  ) else ""
                self.ui.write( "%s%s " % (trunk, marker,) )
                if (trunk in open_branches_in_stream) :
                    # We need this check because the `trunk' could be closed. See Issue#34.
                    open_branches_in_stream.remove( trunk )
            if (open_branches_in_stream) :
                for e in open_branches_in_stream :
                    marker  = "#" if (self._is_shelved( e )) else ""
                    marker += "*" if (e == curr_workspace  ) else ""
                    self.ui.write( "%s%s " % (e, marker,) )
            self.ui.write( "\n" )
        if (sum( [len( heads ) - 1 for name, heads in name_branches] )) :
            self._print( "\n", newline = False )
            self._print( "Multihead branches:" )
            for name, heads in name_branches :
                if (len( heads ) > 1) :
                    self._print( "  %s" % name )
                    for head in heads :
                        self._print( "    %s" % head.rev_node() )
            
    
     
    def init( self, *arg, **kwarg ) :
        """
        Initialize flow.
        """
        config_fname   = os.path.join( self.repo.root, CONFIG_BASENAME )
        master_stream  = "default"
        hotfix_stream  = "hotfix/"
        develop_stream = "develop"
        feature_stream = "feature/"
        release_stream = "release/"
        support_stream = "support/"
        has_goodconfig = False
        
        # Fetches existing condition
        if (os.path.isfile( config_fname )) :
            self._print( "Flow was already initialized for workspace:" )
            cfg = config.config()
            cfg.read( config_fname )
            SECTION = CONFIG_SECTION_BRANCHNAME
            try :
                master_stream  = cfg.get( SECTION, "master"  )
                develop_stream = cfg.get( SECTION, "develop" )
                feature_stream = cfg.get( SECTION, "feature" )
                release_stream = cfg.get( SECTION, "release" )
                hotfix_stream  = cfg.get( SECTION, "hotfix"  )
                support_stream = cfg.get( SECTION, "support" )
                has_goodconfig = True
            except ConfigParser.NoSectionError :
                self._error( "Section [%s] not found in configuration file: %s" % (SECTION, config_fname,) )
                self._error( "Your configuration file is probably in old format or corrupt." )
            except ConfigParser.NoOptionError, e :
                self._error( "%s" % e )
                self._error( "Your configuration file is probably corrupt." )
                
        if (has_goodconfig) :
            self._print( "Repository-specific configuration:" )
            self._print( "<master>  trunk: '%s'"         %  master_stream, prefix = "  " )
            self._print( "<develop> trunk: '%s'"         % develop_stream, prefix = "  " )
            self._print( "<feature> branch prefix: '%s'" % feature_stream, prefix = "  " )
            self._print( "<release> branch prefix: '%s'" % release_stream, prefix = "  " )
            self._print( "<hotfix>  branch prefix: '%s'" %  hotfix_stream, prefix = "  " )
            self._print( "<support> branch prefix: '%s'" % support_stream, prefix = "  " )

        autoshelve = None
        if (self.ui.has_section( "hgflow" ) or self.ui.has_section( "flow" )) :
            self._print( "Global configuration:" )
            autoshelve = self.ui.configbool( "hgflow", "autoshelve" )
            if (self.ui.has_section( "flow" )) :
                autoshelve = self.ui.configbool( "flow", "autoshelve" )
            if (not (autoshelve is None)) :
                self._print( "autoshelve: %s" % ("on" if (autoshelve) else "off"), prefix = "  " )

        # Shall we continue if there already exists a configuration file?
        if (has_goodconfig and not kwarg.get( "force" )) :
            return

        print
        mq = None
        try :
            mq = extensions.find( "mq" )
        except KeyError :
            self._warn( "The 'mq' extension is deactivated. You cannot use some features of flow." )
            print

        workspace = self.curr_workspace
        branches  = self._branches()
        if (len( branches ) > 1) :
            self._warn( "You have the following open branches. Will initialize flow for all of them." )
            for branch in branches :
                if (branch == workspace) :
                    self._warn( "  " + branch.fullname() + " (active)" )
                else :
                    self._warn( "  %s" % branch.fullname() )
            print

        # 'status' method returns a 7-member tuple:
        # 0 modified, 1 added, 2 removed, 3 deleted, 4 unknown(?), 5 ignored, and 6 clean
        orig_repo_status = self.repo.status()[:4]
        for e in orig_repo_status :
            try :
                e.remove( CONFIG_BASENAME )
            except ValueError :
                pass

        if (any( orig_repo_status )) :
            if (len( branches ) > 1 and not mq) :
                raise AbortFlow( "Your workspace has uncommitted changes. Cannot initialize flow for all",
                                 "  open branches. You can either commit the changes or install the 'mq'",
                                 "  extension, and then try again." )

        def get_input( stream_name, default ) :
            while (True) :
                answer = self.ui.prompt( "Branch name for %s stream: [%s]" % (stream_name, default,), default = default )
                if (answer.find( ':' ) > -1) :
                    self._error( "Illegal symbol ':' in branch name" )
                else :
                    return answer
                
        if (not kwarg.get( "default" )) :
            master_stream  = get_input( "master",   master_stream )
            develop_stream = get_input( "develop", develop_stream )
            feature_stream = get_input( "feature", feature_stream )
            release_stream = get_input( "release", release_stream )
            hotfix_stream  = get_input( "hotfix",   hotfix_stream )
            support_stream = get_input( "support", support_stream )

        if (autoshelve is None) :
            self._print( """
When you switch to another branch, flow can automatically shelve uncommitted
changes in workpace right before switching. Later when you switch back, flow can
automatically unshelve the changes to the workspace. This functionality is
called autoshelve. You need the 'mq' extension to use it.""" )
            answer = self.ui.prompt( "Do you want to turn it on? [Yes] ", default = "y" )
            answer = True if (answer.lower() in ["yes", "y", "",]) else False
            if (answer) :
                self._print( """
Here is what you need to do:
  To turn it on for only this repository, edit your <repository-root>/.hg/hgrc
  file by adding the following lines:
      [flow]
      autoshelve = true
  You can turn it on for all of your repositories by doing the same edition to
  your $HOME/.hgrc file. To turn it off, just edit the corresponding file and
  replace 'true' with 'false'.
""" )
                self.ui.prompt( _("Press Enter to continue initialization...") )

        # Creates configuration.
        cfg_contents = ["[%s]" % CONFIG_SECTION_BRANCHNAME,
                        "master  = %s" %  master_stream,
                        "develop = %s" % develop_stream,
                        "feature = %s" % feature_stream,
                        "release = %s" % release_stream,
                        "hotfix  = %s" %  hotfix_stream,
                        "support = %s" % support_stream,]
        def write_config() :
            # Writes the configuration in the current branch.
            if (not commands.dryrun()) :
                with open( config_fname, "w" ) as fh :
                    print >> fh, "\n".join( cfg_contents )
            repo_status = self.repo.status( unknown = True )
            if (CONFIG_BASENAME in repo_status[0]) :
                self._commit( config_fname, message = "flow initialization: Modified configuration file." )
            elif (CONFIG_BASENAME in repo_status[4]) :
                self._add   ( config_fname )
                self._commit( config_fname, message = "flow initialization: Added configuration file." )

        write_config()

        master_trunk, is_open = self._find_branch( master_stream )
        if (master_trunk and not is_open) :
            self._warn( "Branch \"%s\" is currently closed." % master_stream )
            self._warn( "Will reopen and use it as <master> trunk."          )
            branches.append( master_trunk )
            
        develop_trunk, is_open = self._find_branch( develop_stream )
        if (develop_trunk and not is_open) :
            self._warn( "Branch \"%s\" is currently closed." % develop_stream )
            self._warn( "Will reopen and use it as <develop> trunk."          )
            branches.append( develop_trunk )
            
        # Writes the configuration in all the other branches.
        self.autoshelve = True
        self._shelve()
        
        if (len( branches ) > 1) :
            for branch in branches :
                if (branch == workspace) : continue
                self._update( branch )
                write_config()
            self._update( workspace )
    
        # Creates 'master' and 'develop' streams if they don't yet exist.
        if (master_trunk is None) :
            self._create_branch( master_stream, "flow initialization: Created <master> trunk: %s." % master_stream )
        if (develop_trunk is None) :
            self._create_branch( develop_stream, "flow initialization: Created <develop> trunk: %s." % develop_stream )
            
        self._update( workspace )
        self._unshelve()



    def upgrade( self, *arg, **kwarg ) :
        """
        Upgrade older version to the latest version.
        """
        self._print( "Upgrade flow's configuration file from v0.9.4 (or older) to v0.9.5 (or latter)." )
        self._print( "Renaming file '%s' to '%s' in all open branches..." % (OLD_CONFIG_BASENAME, CONFIG_BASENAME,) )
        config_fname     = os.path.join( self.repo.root,     CONFIG_BASENAME )
        old_config_fname = os.path.join( self.repo.root, OLD_CONFIG_BASENAME )
        workspace = self.curr_workspace
        for branch in self._branches() :
            self._print( "  Branch '%s'..." % branch )
            self._update( branch )
            if (os.path.isfile( old_config_fname )) :
                self._rename( old_config_fname, config_fname, force = True )
                self._commit( message = "flow upgrade: Renamed flow's configuration file from '%s' to '%s'." %
                              (OLD_CONFIG_BASENAME, CONFIG_BASENAME,) )
        self._update( workspace )
        self._print( "Upgrading done" )
   
    

def flow_cmd( ui, repo, cmd = None, *arg, **kwarg ) :
    """Flow is a Mercurial extension to support the generalized Driessen's branching model.

actions:

- start    Open a new branch in the stream.
- finish   Close workspace branch and merge it to destination stream(s).
- push     Push workspace branch to the remote repository.
- publish  Same as `push`
- pull     Pull from the remote repository and update workspace branch.
- list     List all open branches in the stream.
- log      Show revision history of branch.
- promote  Merge workspace to other branches. (not closing any branches.)
- rebase   Rebase workspace branch to its parent branch.
- rename   Rename workspace branch to a new basename.
- abort    Abort branch. Close branch without merging.

If no action is specified by user, the action will default to `list`. If a
branch name (instead of action) is given after the stream name, Flow will
switch the current workspace to the branch.

commands:

- init     Initialize flow.
- unshelve Unshelve the previously shelved changes for workspace branch.
- upgrade  Upgrade the configuration file to v0.9.5 or later.
- help     Show help for a specific topic. Example: `hg flow help @help`
- version  Show flow's version number.
"""
    # Supresses bookmarks, otherwise if the name of a bookmark happens to be the same as a named branch, hg will use the
    # bookmark's revision.
    repo._bookmarks = {}

    flow = Flow( ui, repo, cmd in ["init", "upgrade", "help",] )
    func = {
        "init"     : flow.init,
        "upgrade"  : flow.upgrade,
        "unshelve" : flow.unshelve,
        "help"     : Help( ui, repo ).print_help,
        "version"  : flow.print_version,
        None       : flow.print_open_branches,
    }

    commands.use_quiet_channel( kwarg.get( "history" ) )
    commands.dryrun           ( kwarg.get( "dry_run" ) )

    if (kwarg.get( "dry_run" )) :
        _print( ui, "This is a dry run." )
        commands.use_quiet_channel( True )

    # Registers common options (such as "user").
    common_opts = {}
    for e in ["user",] :
        v = kwarg.get( e )
        if (v) :
            common_opts[e] = v
    commands.reg_common_options( common_opts )

    # - Up to this point, `cmd' is a name of command or stream, or `None'.
    # - We assign `stream' to be a stream name (or `None') and `cmd' to be a name of command or action.
    # - When `arg' is a 0-tuple, `cmd' should be "list" as the default action. We use `arg + ("list",)' to ensure we can get
    #   the first element.
    stream, cmd = (None, cmd) if (cmd in func) else (cmd, (arg + ("list",))[0] )

    try :
        # Constructs a `Stream' objects.
        # This will also check the validity of the part of user's input that is supposed to specify a stream.
        if (isinstance( stream, str )) :
            stream = Stream.gen( ui, repo, stream, check = True )
            
        # Checks the options for all commands and actions.
        kwarg = _getopt( ui, cmd, kwarg )
        stamp = kwarg.pop( "stamp", None )
        if (stamp) :
            def stamp_commit_message( opts ) :
                msg = opts["message"]
                if (0 > msg.lower().find( stamp.lower() )) :
                    msg += " %s" % stamp
                opts["message"] = msg
                return opts
            commands.reg_option_mutator( "commit", stamp_commit_message )
        
        func = func.get( cmd, lambda *arg, **kwarg : flow.action( stream, *arg, **kwarg ) )
        func( *arg, **kwarg )
    except AbortFlow, e :
        errmsg = e.error_message()
        _error( ui, *errmsg )
        if (getattr( e, "note", None )) :
            _note( ui, *((e.note,) if (isinstance( e.note, str )) else e.note), via_quiet = True )
        elif (errmsg[0].startswith( "Stream not found" )) :
            misspelling = difflib.get_close_matches( stream, ["init", "upgrade", "unshelve", "help", "version",], 3, 0.7 )
            note = ("Did you mean the command: %s?" % " or ".join( misspelling )) if (misspelling        ) else None
            note = ("Did you mean the command: init?")                            if ("install" == stream) else note
            note = ("Did you mean the command: upgrade?")                         if ("update"  == stream) else note
            if (note) :
                _note( ui, note, via_quiet = True )
            
        if (ui.tracebackflag) :
            if (hasattr( e, "traceback" )) :
                ei = e.traceback
                sys.excepthook( ei[0], ei[1], ei[2] )
                print
            ei = sys.exc_info()
            sys.excepthook( ei[0], ei[1], ei[2] )

    commands.print_history()

    try :
        os.chdir( flow.orig_dir )
    except :
        _print( ui, "The original dir is gone in file system (probably due to updating branch)." )
        _print( ui, "You are now in the root dir of the repository." )



# On Windows, a topic should be wrapped with quotes.
if ("nt" == os.name) :
    flow_cmd.__doc__ = flow_cmd.__doc__.replace( "help @help", 'help "@help"' )

    

class Help( object ) :
    """
    Online help system
    We define all help topics within this class.
    We support text effects on help message. See C{colortable} for predefined effects as C{flow.help.*}. To make it easy to use
    text effects, we invented a primitive markdown syntax. For now, we support only the C{flow.help.code}, which will be
    applied to text wrapped with '{{{' and '}}}'.
    """

    SHORT_USAGE = """
flow: a Mercurial workflow extension

Usage: {{{hg flow {<stream> [<action> [<arg>...]] | <command>} [<option>...]}}}

""" + flow_cmd.__doc__

    TOPIC = {
"@deprecated" : """
The following item has been deprecated in this release and will be removed in
the future:
  * [hgflow]   The '[hgflow]' section name in hg's configuration file has been
               renamed to '[flow]'.
  * Syntax: hg flow <stream> finish {{{<tag-name>}}}
               Replacement syntax: hg flow <stream> finish {{{-t <tag-name>}}}
               Any positional arguments for `finish` will be considered as
               error.
""",

"@examples" : """
{{{> hg flow}}}
flow: Currently open branches:
flow: <master> : default
flow: <develop>: develop develop/0.9#
flow: <feature>: feature/help*
# Show open branches in all streams. The '*' marker indicates the branch which
# the workspace is in, and the '#' marker indicates there are shelved changes
# in the branch.

{{{> hg flow feature finish --history}}}
# Finish the current <feature> branch, and print the history of primitive hg
# commands used by the workflow.

{{{> hg flow develop/0.9:feature start new_v0.9_feature}}}
# Start a new feature branch from the 'develop/0.9' branch.

{{{> hg flow develop/0.9:feature finish --verbose}}}
flow: note: Hg command history:
flow: note:   hg commit --message "flow: Closed <feature> 'help'." --close-branch
flow: note:   hg update develop/0.9
flow: note:   hg merge feature/help
flow: note:   hg commit --message "flow: Merged <feature> 'help' to <develop/0.9> ('develop/0.9')."
flow: note:   hg update develop
flow: note:   hg merge develop/0.9
flow: note:   hg commit --message "flow: Merged <develop/0.9:feature> 'help' to <develop> ('develop')."
# Finish the workspace <feature> branch, merging it to 'develop/0.9', which is
# in turn merged to <develop>'s trunk.
""",

"@master" : """
Master stream contains 1 and only 1 branch that has only and all production
revisions (i.e., official releases). New revisions in <master> are created when
a <release> or <hotfix> branch merges into <master>.
The following actions can be applied to <master>: push, publish, pull, list,
and log.
""",

"@develop" : """
Develop stream contains all changes made for future releases. <release> and
<feature> branches are started from <develop> and will be merged to <develop>
when finished. Since version 0.9, user can create branches in <develop>. A
<develop> branch can be used as the source branch to start <release> and
<feature> branches.
""",

"@feature" : """
Feature stream contains branches where new features for future releases are
developed. Branches in <feature> are created from either <develop> or an
existing <feature> branch.
All actions can be applied to <feature> branches. When a <feature> branch is
finished, it will normally be merged into <develop>.
""",

"@release" : """
Release stream contains branches of release candidates. Code in <release> branch
will usually be tested and bug-fixed. Once a <release> branch is graduated from
the testing and bug-fixing process, it will be merged to both <master> and
<develop>.
""",

"@hotfix" : """
Hotfix stream contains branches for fixing bugs in <master>. <hotfix> branches
are started from <master> and once they are finished will be merged to both
<master> and <develop>.
""",

"@support" : """
Support stream contains branches for supporting a previous release. <support>
branches are started from <master> and will never be merged to anywhere. When
finished, they will be simply closed.
""",

"@start" : """
Start a new branch in stream. <feature> and <release> branches are started from
<develop>. <hotfix> and <support> branches are started from <master>.

syntax:
{{{hg flow <stream> start <name> [<option>...]}}}

options:
 -r --rev REV       Revision to start a new branch from.
 -m --message TEXT  Record TEXT as commit message when opening new branch.
 -p --stamp TEXT    Append TEXT to all commit messages.
 -d --date DATE     Record the specified DATE as commit date.
 -u --user USER     Use specified USER as committer.
    --dirty         Start a new branch from current dirty workspace branch and
                    move all uncommitted changes to the new branch.

The new branch is named after <stream-prefix>/<name>.
""",

"@finish" : """
Finishing a branch in stream means to close the branch and merge the branch to
destination stream(s). <feature> branches will be merged to <develop>, and
<release> and <hotfix> branches will be merged to both <develop> and <master>.
<support> branches will not be merged to anywhere, and they will only be closed.
Note that merging to a non-trunk <develop> branch will cause the <develop>
branch to be merged into the <develop> trunk.

syntax:
{{{hg flow <stream> finish [<option>...]}}}

The workspace branch will be finished. Hgflow intentionally forbids finishing
a branch other than the workspace one, which forces user to update to and
check the branch before finishing it.

The workspace branch must be in the specified <stream>. When the workspace
branch is merged into <master>, a new tag will be added to the corresponding
snapshot in the <master> trunk. User can use the '-t' option to specify the tag
name; if not specified, the tag name will be derived automatically from the
name of the workspace branch by replacing the stream prefix with the
`version_prefix`. The '-t' option has no effect if the workspace branch is not
merged into <master>.

options:
 -c --commit        Commit changes before closing the branch.
 -m --message TEXT  Record TEXT as commit message.
 -p --stamp TEXT    Append TEXT to all commit messages.
 -t --tag NAME      Tag the snapshot in the <master> trunk with NAME.
 -d --date DATE     Record the specified DATE as commit date.
 -u --user USER     Use specified USER as committer.
 -e --erase         Erase branch after it is merged successfully.

N.B.: RE. '--erase': A branch cannot be erased if it has been previously merged
to other branches, creating nodes that are not erased together with the branch.
""",

"@push" : """
Push the workspace branch to the remote repository.

syntax:
{{{hg flow <stream> push}}}

alternative syntax:
{{{hg flow <stream> publish}}}
The two syntaxes are completely equivalent.

The workspace branch must be in <stream>.
""",

"@publish" : """
Push the workspace branch to the remote repository.

syntax:
{{{hg flow <stream> publish}}}

alternative syntax:
{{{hg flow <stream> push}}}
The two syntaxes are completely equivalent.

The workspace branch must be in <stream>.
""",

"@pull" : """
Pull a branch named after <stream-prefix>/<name> from the remote repository and
update the workspace. If <name> is not specified, it defaults to the workspace
branch.

syntax:
{{{hg flow <stream> pull [<name>]}}}

The pulled branch must be in <stream>.
""",

"@list" : """
List all open branches in <stream>.

syntax:
{{{hg flow <stream> list}}}

alternative syntax:
{{{hg flow <stream>}}}
If <stream> has trunk (e.g., <develop> and <master>), this syntax will update
the workspace to the trunk besides listing all open branches in <stream>. If
<stream> does not have trunk (e.g., <feature>, <release>, <hotfix>, and
<support>), this syntax is completely equivalent to the other one (i.e., only
list all open branches in the stream).

option:
 -c --closed    Show open and closed branches in <stream>.

example:
{{{> hg flow hotfix list}}}
flow: Open <hotfix> branches:
flow:   hotfix/0.9.6#
flow:   hotfix/0.9.6/init_-d_option*
# List all currently open branches in <hotfix>. The '*' marker indicates the
# branch which the workspace is in, and the '#' marker indicates that there are
# shelved changes for the branch.
""",

"@log" : """
Show revision history of the specified branch, which must be in <stream>.
syntax:
{{{hg flow <stream> log [<basename>]}}}
where <basename> is of the branch name, e.g., if a branch's name is
'feature/colored_help', its basename relative to <feature> (assuming the
branch name prefix is 'feature/') is 'colored_help'.
If <basename> is missing, it will default to the workspace branch.

Show revision history of a single file in the workspace branch.
syntax:
{{{hg flow <stream> log <filename>}}}
If <filename> happens to be the same as the basename of a branch in <stream>,
it will be recognized as the basename.

alternative syntax:
{{{hg flow <stream> log -F <filename>}}}
Use this syntax to avoid the potential ambiguity with the prior syntax. Also,
you can specify multiple file names to show revision history of these files.

Show revision history of specified files in a designated branch.
syntax:
{{{hg flow <stream> log <basename> -F <filename>}}}

options:
 -F --file FILE [+]  File to show history of.
 -d --date DATE      Show revisions matching date spec.
 -u --user USER      Show revisions committed by USER.
 -k --keyword TEXT   Do case-insensitive search for a given text.
 -p --patch          Show patch.
 -g --git            Use git extended diff format to show patch.
 -l --limit VALUE    Limit number of changesets displayed.
 -c --closed         Show closed branches when used together with -s option.
 
[+] marked option can be specified multiple times.
""",
        
"@abort" : """
Aborting the workspace branch can be done in two ways:
1. The default way is simply marking the branch as closed so that it will not
   show up when you list alive branches, but all changesets in the branch
   remain in the repository and you cannot reuse the branch's name for a
   different branch.
2. The other way is erasing the branch, in other words, completely deleting the
   branch and all changesets in it from the repository. This way is
   devastating, but you can clear unneeded changesets and reuse the branch's
   name. To abort a branch in this way, you just add the {{{-e}}} option.
   N.B.: A branch cannot be erased if you have previously merged it to other
   branches that remain in the repository.

syntax:
{{{hg flow <stream> abort [-m <TEXT>] [-e]}}}

options:
 -m --message TEXT  Record TEXT as commit message when closing branch.
 -p --stamp TEXT    Append TEXT to all commit messages.
 -e --erase         Abort branch and erase it.
""",

"@promote" : """
Merge the workspace branch to destination branches. The destination branches,
if omitted, will default to the trunk of the destination stream. The destination
streams of the basic streams are listed as follows:

   stream          destination
------------+-----------------------
 <feature>    <develop>
 <develop>    <master>
 <release>    <develop> & <master>
 <hotfix>     <develop> & <master>
 <master>     n/a
 <support>    n/a
 natural      stream-trunk
 
syntax:
{{{hg flow <stream> promote [<destination-branch-full-name>...] [<option>...]}}}

The workspace branch must be in <stream>. If the `-r` option is omitted, its
value will default to the head of the workspace branch.

options:
 -r --rev REV       Revision to promote to other branches.
 -m --message TEXT  Record TEXT as commit message when promoting branch.
 -p --stamp TEXT    Append TEXT to all commit messages.
 -t --tag NAME      Tag the merging changeset with NAME
 -d --date DATE     Record the specified DATE as commit date.
 -u --user USER     Use specified USER as committer.

examples:
{{{> hg flow develop promote -t v0.2.0}}}
# Immediately release <develop> trunk's tip into <master>, bypassing <release>.
# What this command exactly does is to promote the <develop> trunk into
# <master> (<master> is <develop>'s default promotion destination, so you don't
# have to spell it out in the command), and then label the <master> snapshot
# with "v0.2.0".
""",
        
"@rebase" : """
Rebase the workspace branch to the specified revision.

syntax:
{{{hg flow <stream> rebase [-d <rev>]}}}

option:
 -p --stamp TEXT  Append TEXT to all commit messages.

The workspace branch must be in <stream>. If the destination revision is not
specified, it will default to the source branch of the workspace branch.
""",
        
"@version" : """
Show version of the flow extension.

syntax:
{{{hg flow version}}}
""",
        
"@rename" : """
Rename the workspace branch to a new basename. Under the hood, this action
will create a new branch with the new basename and copy/graft the commits in
the workspace branch to the new branch, and then erase the workspace branch.
All the user, date, and commit-message information will be copied to the
new branch.

N.B.: The workspace branch should be a simple linear branch. This means:
(1) It has not merged to other branches;
(2) It has no subbranches;
(3) No other branches has merged to this branch.

syntax:
{{{hg flow <stream> rename [-t <basename>]}}}

option:
 -t --to NAME  Rename the basename of the workspace branch to NAME.

The workspace branch must be in <stream>.
""",
        
"@version" : """
Show version of the flow extension.

syntax:
{{{hg flow version}}}
""",

"@init" : """
Initialize the flow extension for the repository. The configuration file:
{{{.hgflow}}} will be written in the root dir of the repository. The file will be
tracked by hg. If you have multiple open branches, the file should be present
and synchronized in all of them -- init command will do this for you
automatically.

syntax:
{{{hg flow init [<option>...]}}}

options:
 -f --force       Force reinitializing flow.
 -u --user USER   Use specified USER as committer.
 -p --stamp TEXT  Append TEXT to all commit messages.
""",

"@upgrade" : """
Upgrade the configuration file from v0.9.4 (or older) to v0.9.5 or later.

syntax:
{{{hg flow upgrade}}}

options:
 -u --user USER   Use specified USER as committer.
 -p --stamp TEXT  Append TEXT to all commit messages.
""",

"@unshelve" : """
Unshelve previously shelved changes by hgflow. Sometimes, unshelving is not
automatically executed because workflow is terminated prematurelly. In such
situations, you can always use the unshelve command to manually restore the
shelved changes.

syntax:
{{{hg flow unshelve}}}
""",

"@terms" : """
Concepts:
- stream
  The entire set of branches of the same type. Stream is not branch, it is a
  set of branches. In general, a stream can contain any number (including zero)
  of branches. The master stream is, however, special in that it contains 1 and
  only 1 branch. The develop stream contains at least one branch.

- basic streams
  Refers to the master, develop, feature, release, hotfix, and support streams
  as predefined in Driessen's model.

- natural streams
  Refers to a set of branches that diverged from and will merge into the same
  branch. The set of branches plus the branch that they diverged from form a
  natural stream. The branch that all the other branches in the same natural
  stream diverged from and will merge into is the trunk of the natural stream.

- trunk
  Trunk is a special branch. A stream can optionally have a trunk, but only one
  trunk at most. For example, master and develop streams each has a trunk,
  whereas feature, release, hotfix, and support streams don't. And all natural
  streams each has a trunk. If a stream has a trunk, all branches in the stream
  normally should diverge from the trunk and later merge to the trunk when they
  are finished.
  Trunk is a relative concept. A trunk of a stream may be a regular branch of
  another stream. (The former stream will be called a substream of the latter.)

- source
  Source is an attribute of stream. The source of a stream refers to the stream
  where branches in the current stream are created from. A stream's source can
  be the stream itself. But this is not always the case, for example,
  the sources of release and feature streams are the develop stream.

- destin
  Destin is another attribute of stream. The destin of a stream refers to the
  stream(s) where branches in the current stream will merge to. A stream's
  destin can be the stream itself. But this is not always the case,
  for example, the destin of release is the develop and the master streams.

- fullname
  Branch name as recognized by the SCM, e.g., feature/enhance_log.

- basename
  Branch name recognized by flow, but not necessarily by SCM, e.g.,
  enhanced_log (with prefix 'feature/' dropped).

- flow action
  Refer to action on a specified stream, e.g., hg flow feature start, where
  'start' is an action.

- flow command
  Commands don't act on a stream, e.g., hg flow unshelve, where 'unshelve'
  is a command.

- hg command
  Refer to commands not from flow extension.

- workflow
  Refer to the process of executing a sequence of hg commands.

- history
  Refer to a sequence of executed hg commands.

Notations
- <stream>
  Examples: <feature>, <hotfix>. These denote the corresponding streams. When
  you refer to a stream, e.g., feature stream, use '<feature>' (or more
  verbosely 'feature stream'), instead of '<feature> stream', because
  '<feature>' already means stream.

- <stream> branch
  Example: a <feature> branch. This phrase refers a branch in <feature>. Do not
  use 'a feature branch' to mean a branch in <feature> because the word
  'feature' there should take its usual meaning as in English, which doesn't
  necessarily mean the feature stream.
""",

"@help" : """
Show online help and then quit. An argument can be optionally given after the
'help' command to specify a particular help topic. Detailed online help is
available for the following topics:
  @all        - Show detailed help for all supported topics.
  @<stream>   - Show help about a particular stream, e.g., {{{@feature}}}, {{{@master}}}.
  @<action>   - Show help about an action, e.g., {{{@finish,}}} {{{@log}}}.
  @<command>  - Show help about a command, e.g., {{{@help}}}, {{{@unshelve}}}.
  @terms      - Show explanations of terminologies used in hgflow.
  @examples   - Show a few command examples.
  @deprecated - Show a list of deprecated features.%s""" %  \
("\nOn Windows platform, a topic should be wrapped with quotes, e.g., {{{\"@finish\"}}}." if ("nt" == os.name) else ""),
}

    def __init__( self, ui, repo ) :
        self.ui   = ui
        self.repo = repo



    def _print( self, s ) :
        """
        Print text with predefined effects.
        @type  s: C{str}
        @param s: String to be printed
        """
        import re
        code_pattern = re.compile( "{{{.*?}}}" )
        last_span    = (0, 0,)
        for match in code_pattern.finditer( s ) :
            span = match.span()
            self.ui.write( s[last_span[1]:span[0]] )
            self.ui.write( s[span[0] + 3:span[1] - 3], label = "flow.help.code" )
            last_span = span
        self.ui.write( s[last_span[1]:] )
        
        
        
    def print_help( self, topic = None, *arg, **opts ) :
        """
        Print help information.

        @type  topic : C{str} or C{None}
        @param topic : Help topic
        """
        if (topic is None) :
            self._print( self.SHORT_USAGE )
        elif (topic == "@all") :
            doc = self.TOPIC.items()
            doc.sort()
            for t, help in doc :
                self.ui.write( "%s" % t, label = "flow.help.topic" )
                self._print( "%s\n" % help )
        else :
            try :
                help_content = self.TOPIC[topic]
                self.ui.write( "%s" % topic, label = "flow.help.topic" )
                self._print( "%s\n" % help_content )
            except KeyError :
                _error( self.ui, "Unknown topic: %s" % topic )
                if (("@" + topic) in self.TOPIC or topic == "all") :
                    _error( self.ui, "Did you mean '@%s'?" % topic )
                _print( self.ui, """Supported topics are the following:
  @all        - Show detailed help for all supported topics.
  @<stream>   - Show help about a particular stream, e.g., @feature, @master.
  @<action>   - Show help about an action, e.g., @finish, @log.
  @<command>  - Show help about a command, e.g., @help, @unshelve.
  @terms      - Show explanations of terminologies used in hgflow.
  @examples   - Show a few command examples.
  @deprecated - Show a list of deprecated features.
""" )
    


OPT_FILTER = {
"init"    : ("force", "user", "stamp", "default",),
"upgrade" : ("user", "stamp",),
"start"   : ("rev", "message", "stamp", "date", "user", "dirty",),
"finish"  : ("commit", "message", "stamp", "tag", "date", "user", "erase", "onstream",),
"list"    : ("closed",),
"log"     : ("file", "date", "user", "keyword", "patch", "git", "limit", "graph", "closed", "onstream",),
"abort"   : ("erase", "message", "stamp", "onstream",),
"promote" : ("rev", "message", "stamp", "tag", "date", "user", "onstream",),
"rebase"  : ("dest", "onstream", "stamp",),
"rename"  : ("to",),
}

OPT_CONFLICT = {
"dest"    : ("-d", '',   ),     # (short-form-of-option, default-value,)
"date"    : ("-d", '',   ),
"default" : ("-d", False,),
"closed"  : ("-c", False,),
"commit"  : ("-c", False,),
"stamp"   : ("-p", ''    ),
"patch"   : ("-p", False ),
"tag"     : ("-t", ''    ),
"to"      : ("-t", ''    ),
}

def _getopt( ui, key, opt ) :
    """
    Return user-specified options.

    We cannot separate options for different subcommands because of the design of the C{cmdtable}. So ambiguity exists for some
    options. For example, the C{-d} option, it means C{dest} for C{rebase} and C{date} for C{finish}. For either of the two
    actions, the value of the C{-d} option could be saved in C{dest} or C{date}. In general, we don't know which one.

    We have to do a bit of parsing to resolve potential ambiguity. This function is here for that purpose. C{opt} is the raw
    option C{dict} from C{hg}. We will reparse it a bit for a particular command or action given by C{key}. The function
    returns a C{dict} that contains the option's name and its value.
    N.B.:
    (1) If the value of an option evaluates to false, the option will be absent in the returned C{dict} object.
    (2) This function will mutate and return C{opt}.

    @type   ui: C{mercurial.ui}
    @param  ui: Mercurial user interface object
    @type  key: C{str}
    @param key: Command or action for which you are getting the options
    @type  opt: C{dict}
    @param opt: Raw options
    
    @raise AbortFlow: AbortFlow exception will be raised if there is option error.
    """
    ret       = {}
    rec_short = []    # A list of recoginized short options
    for e in OPT_FILTER.get( key, [] ) :
        if (opt.get( e )) :
            ret[e] = opt[e]
        elif (e in OPT_CONFLICT) :
            short_opt, default_value = OPT_CONFLICT[e]
            argv = sys.argv
            if (short_opt in argv) :
                rec_short.append( short_opt )
                if (isinstance( default_value, str )) :
                    index  = argv.index( short_opt )
                    try :
                        ret[e] = argv[index + 1]
                    except IndexError :
                        raise AbortFlow( "Value not found for %s option." % short_opt )
                else :
                    ret[e] = not default_value

    bad_opt = [e for e in     opt if (e not in (["history", "dry_run"] + ret.keys()) and opt[e])]
    bad_opt = [e for e in bad_opt if (e in sys.argv) or (OPT_CONFLICT.get( e, [0,] )[0] not in rec_short)]
    
    if (bad_opt) :
        bad_opt = [e.replace( "_", "-" ) for e in bad_opt]
        if (key is None) :
            raise AbortFlow( "Unrecognized option%s for `hg flow`: %s." %
                             ("" if (len( bad_opt ) == 1) else "s", "--" + (", --".join( bad_opt )),),
                             note = "`hg flow` should take no options." )
        elif (key in Flow.ACTION_NAME) :
            raise AbortFlow( "Unrecognized option%s for `%s`: %s." %
                             ("" if (len( bad_opt ) == 1) else "s", key, "--" + (", --".join( bad_opt )),),
                             note = "Execute `hg flow help @%s` to see available options for `%s`." % (key, key,) )
        else :
            raise AbortFlow( "Unrecognized option%s: %s." %
                             ("" if (len( bad_opt ) == 1) else "s", "--" + (", --".join( bad_opt )),) )
            
    return ret



cmdtable = {
"flow" :
    (flow_cmd,
     [("",  "history",   False, _("Print history of hg commands used in this workflow."),                          ),
      ("",  "dry-run",   None,  _("Do not perform actions, just print history."),                                  ),
      ("",  "dirty",     False, _("Start a new branch from a dirty workspace, and move all"
                                  " uncommitted changes to the new branch. [start]"),                              ),
      ("c", "closed",    False, _("Show normal and closed branches in stream. [list, log]"),                       ),
      ("c", "commit",    False, _("Commit changes before closing the branch. [finish]"),                           ),
      ("d", "default",   False, _("Initialize flow with default configuration. [init]"),                           ),
      ("d", "date",      '',    _("Record the specified date as commit date. [start, finish, promote]"), _('DATE'),),
      ("d", "date",      '',    _("Show revisions matching date spec. [log]"),                           _('DATE'),),
      ("d", "dest",      '',    _("Destination changeset of rebasing. [rebase]"),                        _('REV' ),),
      ("e", "erase",     False, _("Erase branch after it is merged or aborted successfully. [finish, abort]"),     ),
      ("F", "file",      [],    _("File to show history of. [log]"),                                     _('FILE'),),
      ("f", "force",     False, _("Force reinitializing flow. [init]"),                                            ),
      ("g", "git",       False, _("Use git extended diff format to show patch. [log]"),                            ),
      ("k", "keyword",   '',    _("Do case-insensitive search for a given text. [log]"),                 _('TEXT'),),
      ("l", "limit",     '',    _("Limit number of changesets displayed. [log]"),                                  ),
      ("m", "message",   '',    _("Record TEXT as commit message. [start, finish, promote, abort]"),     _('TEXT'),),
      ("p", "stamp",     '',    _("Append TEXT to all commit messages. [init, upgrade, start, finish,"
                                  " promote, rebase, abort]"),                                           _('TEXT'),),
      ("p", "patch",     False, _("Show patch. [log]"),                                                            ),
      ("r", "rev",       '',    _("Revision to start a new branch from. [start]"),                       _('REV'), ),
      ("r", "rev",       '',    _("Revision to promote to other branches. [promote]"),                   _('REV'), ),
      ("s", "onstream",  False, _("Act on stream. [finish, rebase, log, abort]"),                                  ),
      ("t", "tag",       '',    _("Tag the merging changeset with NAME. [promote]"),                     _('NAME'),),
      ("t", "tag",       '',    _("Tag the <master> trunk with NAME after merging. [finish]"),           _('NAME'),),
      ("t", "to",        '',    _("Rename the branch to NAME. [rename]"),                                _('NAME'),),
      ("u", "user",      '',    _("Use specified user as committer. [init, upgrade, start, finish,"
                                  " promote]"),                                                          _('USER'),),
      ("u", "user",      '',    _("Show revisions committed by specified user. [log]"),                  _('USER'),),
     ],
     "hg flow {<stream> [<action> [<arg>]] | <command>} [<option>...]",
     ),
}
