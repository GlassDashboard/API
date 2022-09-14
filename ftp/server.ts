import { randomBytes } from 'crypto';
import * as ftpd from 'ftp-srv';
import { UserModel } from '../models/user';
import { onlineServers, ServerSocket } from '../servers/socket';
import MinehutFileSystem from './MinehutFS';

const server = new ftpd.FtpSrv({
	url: 'ftp://' + process.env.FTP_BIND + ':' + process.env.FTP_PORT,
	anonymous: false,
	greeting: [' ', 'MHWeb', 'Welcome to MHWeb FTP Server', 'This feature is still in development, so expect a few bugs.', ' ']
});

server.on('login', async ({ connection, username, password }, resolve, reject: any) => {
	const connectionDetails = username.split('.');
	if (connectionDetails.length != 2) {
		connection.reply(400, '[MHWeb] Invalid connection details, double check your username and password');
		return reject('Invalid connection details');
	}

	// Check if server is online
	const server: ServerSocket | undefined = onlineServers.get(connectionDetails[0].toLowerCase());
	if (server == null) {
		connection.reply(404, '[MHWeb] Server is not currently online, try starting the server up and make sure it is connected properly');
		return reject('Server is not currently online');
	}

	// Try fetching ftp details from server
	const ftpDetails = server.server.ftp.find((ftp) => {
		return ftp.identifier == connectionDetails[1] && ftp.password == password;
	});

	// Check if password is correct
	if (ftpDetails == null) return reject('Invalid username or password');

	// Fetch user from database
	const user = await UserModel.findById(ftpDetails.assignee);
	if (user == null) return reject('Invalid username or password');

	return resolve({ fs: new MinehutFileSystem(server, user, connection) });
});

export function start() {
	server.listen().then(() => {
		console.log('FTP Server listening on port ' + process.env.FTP_PORT);
	});
}
