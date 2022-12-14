import ms from 'ms';

export default (limit: number, time: number | string, global: boolean = false) => {
	var hits = {};
	if (time == undefined) time = 60000;
	else time = ms(time);

	// Clear limits
	setInterval(() => {
		hits = {};
	}, time as number);

	return (req, res, next) => {
		var ip: string = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		if (global) ip = 'global';

		// Headers
		res.setHeader('X-RateLimit-Limit', limit);
		res.setHeader('Date', new Date().toUTCString());

		// Check if rate limit is reached
		if ((hits[ip] || 0) >= limit) {
			res.setHeader('X-RateLimit-Remaining', 0);
			return res.status(429).json({ error: true, message: 'You are being rate limited! Try again later.' });
		} else {
			hits[ip] = Math.min((hits[ip] || 0) + 1, limit);
			res.setHeader('X-RateLimit-Remaining', limit - (hits[ip] || 0));
			next();
		}
	};
};
