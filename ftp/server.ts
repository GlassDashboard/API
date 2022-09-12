import * as ftpd from 'ftp-srv';
import { onlineServers, ServerSocket } from '../servers/socket';
import MinehutFileSystem from './MinehutFS';

const server = new ftpd.FtpSrv({
	url: 'ftp://' + process.env.FTP_BIND + ':' + process.env.FTP_PORT,
	anonymous: false,
	greeting: [' ', 'MHWeb', 'Welcome to MHWeb FTP Server', 'This feature is still in development, so expect a few bugs.', ' ']
});

server.on('login', async ({ connection, username, password }, resolve, reject: any) => {
	// Check if server is online
	const server: ServerSocket | undefined = onlineServers.get(username.toLowerCase());
	if (server == null) {
		connection.reply(404, 'Server is not currently online, try starting the server up and make sure it is connected properly');
		return reject('Server is not currently online');
	}

	// Check if password is correct
	if (password !== server.server.ftpPassword) return reject('Invalid username or password');

	return resolve({ fs: new MinehutFileSystem(server, connection) });
});

export function start() {
	server.listen().then(() => {
		console.log('FTP Server listening on port ' + process.env.FTP_PORT);
	});
}
