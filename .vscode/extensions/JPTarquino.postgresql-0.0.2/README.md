# PostgresSql for Visual Studio Code

This extension the following features when working with pgsql files in VS Code:

- Colorization
- Snippets
- Execute Current File using psql (vs command)
- Completion Lists for global postgres functions (copied from the Postgres official documentation)

The extension recognizes the .pgsql extension as sql files intended to be run in Postgres.

## Pre-requisites for executing a pgsql file

To run the current .pgsql file through pgsql (Postgres native client) you must add the following settings to your workspace:

```javascript

{
    "postgreSql.dbName": "postgres OR THE DB YOU WANT TO CONNECT TO",
    "postgreSql.hostName": "YOUR POSTGRES SERVER",
    "postgreSql.username": "YOUR POSTGRES USERNAME"
}
```

You must also ensure that psql is in the OS executable path (it will be executed as simply "psql" from vscode).

The command to run the current file is "Postgres: Execute File in Server".