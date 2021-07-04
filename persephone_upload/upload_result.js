'use strict';

let params = (new URL(document.location)).searchParams;

document.querySelector('#status').innerText = params.get('status');
document.querySelector('#title').innerText = params.get('title');

let uri = document.querySelector('#uri');
uri.href = params.get('uri');
uri.innerText = decodeURI(params.get('uri'));

let page = document.querySelector('#page');
page.href = params.get('page');
page.innerText = params.get('page');

if (params.get('errors')) {
	document.querySelector('#errors').innerText = params.get('errors');
}

let view_uri = params.get('view_uri');
if (view_uri) {
	let view = document.querySelector('#view');
	view.href = params.get('instance_uri') + view_uri;
	view.innerText = 'View';
}
