return {
	action_logout: function() {
		const cookie_path = dispatcher.build_url();
		const redirect_url = dispatcher.build_url('oum');

		if (ctx.authsession) {
			ubus.call('session', 'destroy', { ubus_rpc_session: ctx.authsession });

			if (http.getenv('HTTPS') == 'on')
				http.header('Set-Cookie', `sysauth_https=; expires=Thu, 01 Jan 1970 01:00:00 GMT; path=${cookie_path}`);
			else
				http.header('Set-Cookie', `sysauth_http=; expires=Thu, 01 Jan 1970 01:00:00 GMT; path=${cookie_path}`);
		}

		http.redirect(redirect_url);
	}
};
