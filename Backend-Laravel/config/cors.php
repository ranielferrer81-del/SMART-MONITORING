<?php

return [

	'paths' => ['api/*', 'storage/*', 'sanctum/csrf-cookie'],

	'allowed_methods' => ['*'],

	// Allow requests from the React web app, Vite dev server, and the desktop app (file:// / Electron).
	// Using '*' here is fine for this project since we only expose our own API.
	'allowed_origins' => ['*'],

	'allowed_origins_patterns' => [],

	'allowed_headers' => ['*'],

	'exposed_headers' => [],

	'max_age' => 0,

	'supports_credentials' => false,

];