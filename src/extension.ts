/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { workspace } from 'vscode';
import {
	LanguageClient, LanguageClientOptions, ServerOptions, StreamInfo
} from 'vscode-languageclient/node';
import PromiseSocket from 'promise-socket';

let client: LanguageClient;

// Called by vscode on activation event, see package.json "activationEvents"
export function activate(context: vscode.ExtensionContext): void {
    client = startLanguageClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	if (client) {
        return client.stop();
	}
    return undefined;
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
	const serverOptions = getSocketServerOptions(context) || getEmbeddedServerOptions(context);

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
	  // Register the server for scriber documents
	  documentSelector: [{ scheme: 'file', language: 'scriber' }],
	  synchronize: {
		// Notify the server about file changes to scriber files contained in the workspace
		fileEvents: workspace.createFileSystemWatcher('**/*.sc')
	  }
	};

	// Create the language client and start the client.
	const client = new LanguageClient(
	  'scriber',
	  'Scriber',
	  serverOptions,
	  clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
    return client;
}

function getEmbeddedServerOptions(context: vscode.ExtensionContext): ServerOptions  {
	const executable = process.platform === 'win32' ? 'scriber-language-server.bat' : 'scriber-language-server';
	const languageServerPath = context.asAbsolutePath(path.join('server', 'scriber-language-server', 'bin', executable));
	if (process.platform === 'win32') {
		return {
			run: {
				command: languageServerPath,
				args: []
			},
			debug: {
				command: languageServerPath,
				args: []
			}
		};
	} else {
		return {
			run: {
				command: 'sh',
				args: [languageServerPath]
			},
			debug: {
				command: 'sh',
				args: [languageServerPath]
			}
		};
	}
}

function getSocketServerOptions(context: vscode.ExtensionContext): ServerOptions | undefined {
	if (process.env.LSP_SOCKET) {
		const [host, port] = process.env.LSP_SOCKET.split(':');
		const serverOptions: ServerOptions = function createServer(): Promise<StreamInfo> {
			return new Promise<StreamInfo>(async (resolve) => {
				const socketPromise = new PromiseSocket();
				socketPromise.setTimeout(2000000);
				const socketOptions: net.SocketConnectOpts = {
					port: parseInt(port, 10),
					host
				};
				console.log(`attempting to connect to LSP socket at host:port '${host}:${port}'`);
				await socketPromise.connect(socketOptions);
				console.log(`opened LSP socket at host:port '${host}:${port}'`);
				const clientSocket = socketPromise.stream;
				const streamInfo: StreamInfo = {
					reader: clientSocket,
					writer: clientSocket
				};
				resolve(streamInfo);
			});
		};
		return serverOptions;
	}
	return undefined;
}
