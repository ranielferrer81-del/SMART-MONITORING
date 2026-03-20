<?php

return [

	// Apply CORS headers globally so Railway/route matching differences
	// don't cause missing Access-Control-Allow-Origin on preflight.
	'paths' => ['*'],

	'allowed_methods' => ['*'],

	'allowed_origins' => ['*'],

	'allowed_origins_patterns' => [
		'#https://.*\.up\.railway\.app#',
	],

	'allowed_headers' => ['*'],

	'exposed_headers' => [],

	'max_age' => 86400,

	'supports_credentials' => false,

];