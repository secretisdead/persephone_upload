'use strict';

chrome.browserAction.onClicked.addListener((tab) => {
	if (chrome.runtime.openOptionsPage) {
		chrome.runtime.openOptionsPage();
	}
	else {
		window.open(chrome.runtime.getURL('options.html'));
	}
});

let instances = [];

function generate_context_menus() {
	chrome.contextMenus.removeAll(() => {
		chrome.storage.sync.get(['instances'], (data) => {
			if (!data.instances) {
				return;
			}
			instances = JSON.parse(data.instances);
			if (1 == instances.length) {
				let instance = instances[0];
				chrome.contextMenus.create({
					title: 'Upload to persephone ' + instance['title'],
					id: 'persephone_upload',
					contexts : [
						'selection',
						'video',
						'image',
						'link',
					],
					onclick: (info, tab) => {
						handle_upload_request(instance, info, tab);
					},
				});
			}
			else if (1 < instances.length) {
				chrome.contextMenus.create({
					title: 'Upload to persephone',
					id: 'persephone_upload',
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
						'title': instance['title'],
						parentId: 'persephone_upload',
						contexts : [
							'selection',
							'video',
							'image',
							'link',
						],
						onclick: (info, tab) => {
							handle_upload_request(instance, info, tab);
						},
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

generate_context_menus();

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
		},
		(response) => {
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
			fd.append('file_uri', response.uri);
			fd.append('view_endpoint', 'persephone.search_public_media');
			let xhr = new XMLHttpRequest();
			xhr.onreadystatechange = () => {
				if (xhr.readyState == XMLHttpRequest.DONE) {
					let uri = '/upload_result.html?status=' + xhr.status + '&title=' + instance.title + '&instance_uri=' + instance.uri + '&uri=' + response.uri;
					if (200 == xhr.status) {
						let start_position = xhr.response.thumbnail.indexOf('a href=') + 8;
						let view_uri = xhr.response.thumbnail.substring(start_position);
						let end_position = view_uri.indexOf('"');
						uri += '&view_uri=' + view_uri.substring(0, end_position);
					}
					else {
						if (409 == xhr.status) {
							uri += '&view_uri=' + xhr.response.view_uri;
						}
						if (
							xhr.response
							&& xhr.response.errors
						) {
							let errors = '';
							for (let i = 0; i < xhr.response.errors.length; i++) {
								errors += xhr.response.errors[i] + ', ';
							}
							uri += '&errors=' + errors.substring(0, errors.length - 2);
						}
					}
					chrome.tabs.create({
						url: uri,
						active: false,
					});
				}
			};
			let action = instance.uri + '/api/media/medium/upload';
			xhr.open('POST', action + (-1 != action.indexOf('?') ? '&' : '?') + '_' + new Date().getTime(), true);
			xhr.withCredentials = true;
			xhr.responseType = 'json';
			xhr.send(fd);
		},
	);
}
