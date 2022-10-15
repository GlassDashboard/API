import { FileSystem, FtpConnection } from 'ftp-srv';
import { fs, vol } from 'memfs';
import { ServerSocket } from '../servers/socket';
import { isAbsolute, normalize, join } from 'path';
import uuid from 'uuid';
import { User } from '../models/user';

export default class MinehutFileSystem extends FileSystem {
	server: ServerSocket;
	user: User;
	connection: FtpConnection;

	cwd: string;
	prefix: string;

	constructor(server: ServerSocket, user: User, connection: FtpConnection) {
		super(connection, { root: '/' + server.server.name, cwd: '/' + server.server.name });
		this.prefix = '/' + server.server.name;

		this.connection = connection;
		this.user = user;
		this.server = server;

		this.cwd = this.prefix;
	}

	_resolvePath(path = '.') {
		if (path == '.') return this.cwd;
		if (isAbsolute(path)) return normalize(path);
		return normalize(join(this.cwd, path)).replace(/\\/g, '/');
	}

	currentDirectory(): string {
		return this.cwd;
	}

	async getFileData(path: string): Promise<any> {
		return new Promise((resolve, _) => {
			this.server.send(
				JSON.stringify({
					type: 'FETCH_FILE',
					path: path.startsWith(this.prefix) ? path.substring(this.prefix.length) : path
				})
			);

			this.server.once('FILE_DATA', async ({ file }) => {
				resolve(file);
			});
		});
	}

	async getAllFiles(path: string): Promise<any> {
		return new Promise((resolve, _) => {
			this.server.send(
				JSON.stringify({
					type: 'FETCH_ALL_FILES',
					path: path.startsWith(this.prefix) ? path.substring(this.prefix.length) : path
				})
			);

			this.server.once('ALL_FILES', async ({ files }) => {
				resolve(
					files.map((file) => {
						if (file.name.startsWith(path)) file.name.substring(path.length);
						return file;
					})
				);
			});
		});
	}

	toJSON(files: any[]): any {
		var map = {};
		if (files.length == 0) return map;

		files.reduce((_, file) => {
			if (file.name.startsWith('/__resources')) return map;
			if (file.directory) map[this.prefix + file.name] = [];
			else map[this.prefix + file.name.replace(/\\/g, '/')] = 'No Content Saved';
			return map;
		});

		return map;
	}

	async toStats(path: string): Promise<any> {
		const fsPath = this._resolvePath(path).replace(/\\/g, '/');

		return new Promise(async (resolve, _) => {
			const files = await this.getAllFiles(fsPath);

			vol.fromJSON(this.toJSON(files), this.prefix);
			const names = await fs.readdirSync(path);

			const stats = await Promise.all(
				names.map(async (file) => {
					const stat = await fs.promises.stat(join(path, file).replace(/\\/g, '/'));
					stat['name'] = file;
					return stat;
				})
			);

			resolve(stats);
		});
	}

	// in: path (file/directory)
	// out: Stat
	async get(fileName: string): Promise<any> {
		const fsPath = this._resolvePath(fileName).replace(/\\/g, '/');

		return new Promise(async (resolve, reject) => {
			const data = await this.getFileData(fsPath);
			if (data.error) {
				this.connection.reply(550, `[Glass] ${data.error}`);
				return reject(data.error);
			}

			const files = await this.toJSON(await this.getAllFiles(fsPath));
			vol.fromJSON(files, this.prefix);

			const stats = await fs.promises.stat(fsPath);
			stats['name'] = data.name;

			resolve(stats);
		});
	}

	// in: path (dir)
	// out: [Stat]
	async list(path: string = '.'): Promise<any> {
		var fsPath = this._resolvePath(path).replace(/\\/g, '/');
		return await this.toStats(fsPath);
	}

	async chdir(path: string = '.'): Promise<string> {
		this.cwd = this._resolvePath(path).replace('\\', '/');
		if (this.cwd == '\\') this.cwd = '/';
		if (this.cwd == '/') this.cwd == this.prefix;
		this.cwd = this.cwd.replace(/\\/g, '/'); // no idea why, but I need this twice, cant even tell you why
		return this.cwd;
	}

	write(fileName: string, { append, start }: { append: boolean; start: any }): any {}

	read(fileName: string, { start }: { start: any }): Promise<any> {
		return new Promise((resolve, reject) => {});
	}

	delete(path: string): Promise<any> {
		throw new Error('Method not implemented.');
	}

	mkdir(path: string): Promise<any> {
		throw new Error('Method not implemented.');
	}

	rename(from: string, to: string): Promise<any> {
		throw new Error('Method not implemented.');
	}

	async chmod(path: string, mode: string): Promise<any> {
		this.connection.reply(550, `[Glass] You are not permitted to do this!`);
	}

	getUniqueName(fileName: string): string {
		return uuid.v4().replace(/\W/g, '');
	}
}
