'use strict';

console.log('starting janky download/reupload');

let params = (new URL(document.location)).searchParams;
for (let param of params.entries()) {
	console.log(param);
}
let tags = params.get('tags');
let uri = params.get('uri');
let page = params.get('page');
console.log(params.get('instance'));
let instance = JSON.parse(params.get('instance'));
console.log(instance);

let info = document.createElement('div');
info.innerHTML = 'reuploading uri: <a href="' + uri + '">' + uri + '</a><br>from page: <a href="' + page + '">' + page + '</a><br>to: ' + instance['title'];
document.body.insertBefore(info, document.body.firstChild);

let tempDownloadID = null;

document.querySelector('#download').addEventListener('click', e => {
	// hide download button
	document.querySelector('#download').style.display = 'none';
	// display downloading message
	document.querySelector('#downloading').style.display = 'block';
	let temp_filename = 'persephone_upload_temp_download_' + Date.now();
	// start download
	chrome.downloads.download({
		filename: temp_filename,
		saveAs: false,
		url: uri,
	}, downloadID => {
		checkDownload(downloadID);
	});
});

function checkDownload(downloadID) {
	chrome.downloads.search({ id: downloadID }, downloadItems => {
		let dl = downloadItems[0];
		if ('interrupted' == dl.state) {
			alert('problem downloading file');
			return;
		}
		if ('in_progress' == dl.state) {
			let remaining = new Date(dl.estimatedEndTime).getTime() / 1000 - Date.now();
			if (0 > remaining) {
				checkDownload(downloadID);
				return;
			}
			setTimeout(() => {
				checkDownload(downloadID);
			}, remaining * 1000);
		}
		else if ('complete' == dl.state) {
			downloadFinished(dl);
		}
	});
}

function downloadFinished(dl) {
	tempDownloadID = dl.id;
	// hide downloading message
	document.querySelector('#downloading').style.display = 'none';
	// show file input
	document.querySelector('#path').innerText = dl.filename;
	document.querySelector('[for=file_upload]').style.display = 'block';
	document.querySelector('#file_upload').style.display = 'inline-block';
}

// listen for file field change
document.querySelector('#file_upload').addEventListener('change', e => {
	// build fd and submit with fetch
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
	fd.append('tags', instance.settings.tags + '#' + tags);
	fd.append('view_endpoint', 'persephone.search_public_media');

	//TODO get filename from uri
	let filename = 'reupload';
	fd.append('file_upload', document.querySelector('#file_upload').files[0], filename);

	let action = instance.uri + '/api/media/medium/upload';
	action = action + (-1 != action.indexOf('?') ? '&' : '?') + '_' + new Date().getTime();
	let options = {
		method: 'POST',
		credentials: 'include',
		body: fd,
	};
	// hide file input
	document.querySelector('[for=file_upload]').style.display = 'none';
	document.querySelector('#file_upload').style.display = 'none';
	// show uploading
	document.querySelector('#uploading').style.display = 'block';
	// submit fetch
	fetch(action, options).then(fetchResponse => {
		let simpleResponse = {
			status: fetchResponse.status,
			ok: fetchResponse.ok,
			json: [],
		};
		if (fetchResponse.ok || 409 == simpleResponse.status) {
			fetchResponse.json().then(fetchResponse => {
				simpleResponse.json = fetchResponse;
				sendReuploadFinished(simpleResponse);
			});
		}
		else {
			sendReuploadFinished(simpleResponse);
		}
	});
});

function sendReuploadFinished(simpleResponse) {
	// send message to service worker with response to handle
	chrome.runtime.sendMessage({
		message: 'reupload_finished',
		uri: uri,
		page: page,
		instance: JSON.stringify(instance),
		simpleResponse: JSON.stringify(simpleResponse),
	});
	// delete temp file
	chrome.downloads.removeFile(tempDownloadID);
}
