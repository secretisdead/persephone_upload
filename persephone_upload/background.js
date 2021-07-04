'use strict';

chrome.runtime.onInstalled.addListener(function() {
	generate_context_menus();
	console.log('installed persephone upload service worker');
});

chrome.action.onClicked.addListener((tab) => {
	if (chrome.runtime.openOptionsPage) {
		chrome.runtime.openOptionsPage();
	}
	else {
		window.open(chrome.runtime.getURL('options.html'));
	}
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
	if (-1 == info.menuItemId.indexOf(':')) {
		return;
	}
	let instance = info.menuItemId.split(':');
	instance.shift();
	instance = instance.join(':');
	instance = JSON.parse(instance);
	handle_upload_request(instance, info, tab);
});

function generate_context_menus() {
	let instances = [];
	chrome.contextMenus.removeAll(() => {
		chrome.storage.sync.get(['instances'], (data) => {
			if (!data.instances) {
				return;
			}
			instances = JSON.parse(data.instances);
			if (1 == instances.length) {
				let instance = instances[0];
				chrome.contextMenus.create({
					id: 'persephone_upload:' + JSON.stringify(instance),
					title: 'Upload to persephone ' + instance['title'],
					contexts : [
						'selection',
						'video',
						'image',
						'link',
					],
				});
			}
			else if (1 < instances.length) {
				chrome.contextMenus.create({
					id: 'persephone_upload',
					title: 'Upload to persephone',
					contexts : [
						'selection',
						'video',
						'image',
						'link',
					],
				});
				for (let i = 0; i < instances.length; i++) {
					let instance = instances[i];
					chrome.contextMenus.create({
						id: 'persephone_upload:' + JSON.stringify(instance),
						title: instance['title'],
						parentId: 'persephone_upload',
						contexts : [
							'selection',
							'video',
							'image',
							'link',
						],
					});
				}
			}
		});
	});
}

chrome.runtime.onMessage.addListener((request, sender) => {
	if ('refresh_context_menus' == request.message) {
		generate_context_menus();
	}
});

function handle_fetch_response(instance, uri, page, response) {
	let uploadResultURI = '/upload_result.html?status=' + response.status + '&title=' + instance.title + '&instance_uri=' + instance.uri + '&uri=' + uri + '&page=' + page;
	if (response.ok) {
		let start_position = response.json.thumbnail.indexOf('a href=') + 8;
		let view_uri = response.json.thumbnail.substring(start_position);
		let end_position = view_uri.indexOf('"');
		chrome.tabs.create({
			url: instance.uri + view_uri.substring(0, end_position),
			active: false,
		});
		return;
	}
	if (409 == response.status) {
		uploadResultURI += '&view_uri=' + response.json.view_uri;
		chrome.tabs.create({
			url: uploadResultURI,
			active: false,
		});
	}
	else {
		chrome.tabs.create({
			url: uploadResultURI,
			active: false,
		});
	}
};

function handle_upload_request(instance, info, tab) {
	let attribute = '';
	let uri = '';
	if (info.srcUrl) {
		attribute = 'src';
		uri = info.srcUrl;
	}
	else if (info.linkUrl) {
		attribute = 'href';
		uri = info.linkUrl;
	}
	else {
		alert('Problem finding file to upload');
		return;
	}
	chrome.tabs.sendMessage(
		tab.id,
		{
			message: 'get_target',
			attribute: attribute,
			uri: uri,
			instance: instance,
		},
		(response) => {
			if (!response) {
				return;
			}
			if (response.reupload) {
				chrome.windows.create({
					focused: true,
					type: 'popup',
					//width: 256,
					height: 256,
					url: chrome.runtime.getURL('v3/reupload.html?uri=' + encodeURIComponent(response.uri) + '&page=' + encodeURIComponent(response.page) + '&instance=' + JSON.stringify(instance) + '&tags=' + encodeURIComponent(response.tags)),
				});
				return;
			}
			let fd = new FormData();
			if (instance.settings.generate_summaries) {
				fd.append('generate_summaries', 1);
			}
			if (instance.settings.filename_tag) {
				fd.append('filename_tag', 1);
			}
			fd.append('owner_id', instance.settings.owner_id);
			fd.append('searchability', instance.settings.searchability);
			fd.append('protection', instance.settings.protection);
			fd.append('creation_date', instance.settings.creation_date);
			fd.append('tags', instance.settings.tags + '#' + response.tags);
			fd.append('view_endpoint', 'persephone.search_public_media');
			fd.append('file_uri', response.uri);

			let action = instance.uri + '/api/media/medium/upload';
			action = action + (-1 != action.indexOf('?') ? '&' : '?') + '_' + new Date().getTime();
			let options = {
				method: 'POST',
				credentials: 'include',
				body: fd,
			};
			fetch(action, options).then(fetchResponse => {
				let simpleResponse = {
					status: fetchResponse.status,
					ok: fetchResponse.ok,
					json: [],
				};
				if (fetchResponse.ok || 409 == simpleResponse.status) {
					fetchResponse.json().then(fetchResponse => {
						simpleResponse.json = fetchResponse;
						handle_fetch_response(
							instance,
							response.uri,
							response.page,
							simpleResponse
						);
					});
				}
				else {
					handle_fetch_response(
						instance,
						response.uri,
						response.page,
						simpleResponse
					);
				}
			});
		}
	);
}

// handle finished reupload
chrome.runtime.onMessage.addListener((request, sender) => {
	if ('reupload_finished' != request.message) {
		return false;
	}
	handle_fetch_response(
		JSON.parse(request.instance),
		request.uri,
		request.page,
		JSON.parse(request.simpleResponse)
	);
	// close popup tab
	chrome.tabs.remove(sender.tab.id);
});
