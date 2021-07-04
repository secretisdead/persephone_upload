'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if ('get_target' != request.message) {
		return false;
	}

	console.log('persephone upload get_target request:');
	console.log('  from page: ' + window.location);
	console.log('  request attribute: ' + request.attribute);
	console.log('  request uri: ' + request.uri);
	console.log('  request instance: ' + JSON.stringify(request.instance));

	let response = {
		message: 'upload_target',
		uri: request.uri,
		tags: '',
		reupload: false,
		page: encodeURIComponent(window.location),
	};

	let target = document.body.querySelector('[' + request.attribute + '="' + request.uri + '"]');
	if (!target && 'src' == request.attribute) {
		target = document.body.querySelector('[srcset*="' + request.uri + '"]');
		if (target && !target.hasOwnProperty('src')) {
			target.src = response.uri;
		}
	}
	// couldn't get target first try for twitter proper tweet link target
	if (
		!target
		&& 'href' == request.attribute
		&& -1 != window.location.host.search(/twitter.com/)
	) {
		let request_uri_parts = request.uri.split('/');
		let fixed_request_uri = '/' + request_uri_parts[request_uri_parts.length - 3] + '/' + request_uri_parts[request_uri_parts.length - 2] + '/' + request_uri_parts[request_uri_parts.length - 1];
		target = document.body.querySelector('[' + request.attribute + '="' + fixed_request_uri + '"]')
	}
	if (!target) {
		alert('Problem getting target, try opening the file directly');
		return false;
	}

	// determine site and get tag information if available
	let post = null;
	let site = '';
	// tumblr
	if (-1 != window.location.host.search(/tumblr/)) {
		site = 'tumblr';
		post = target;
		// climb until we find the post container or the document body
		while (
			!post.classList.contains('post')
			&& document.body != post
		) {
			post = post.parentNode;
		}
		if (!post.classList.contains('post')) {
			post = null;
		}
		else {
			let source = post.querySelector('.post-source-link.post_info_link[data-peepr]');
			// source was some other tumblr
			if (source) {
					let peepr = JSON.parse(source.dataset.peepr);
					response.tags += '#author:' + peepr.tumblelog;
					if (request.instance.settings.mirror_tag) {
						response.tags += '#mirror:http://' + peepr.tumblelog + '.tumblr.com/post/' + peepr.postId;
					}
			}
			// source was this tumblr
			else {
				response.tags += '#author:' + post.dataset.tumblelog;
				if (request.instance.settings.mirror_tag) {
					response.tags += '#mirror:' + 'http://' + post.dataset.tumblelog + '.tumblr.com/post/' + post.dataset.id;
				}
			}
			// direct video
			if (post.classList.contains('is_direct_video')) {
				let video_source = post.querySelector('video>source');
				if (video_source) {
					response.uri = video_source.getAttribute('src');
				}
			}
		}
	}
	// tweetdeck
	else if (-1 != window.location.host.search(/tweetdeck.twitter.com/)) {
		site = 'tweetdeck';
		post = target;
		// climb until we find the post container or the document body
		while (
			'tweet' != post.dataset.dragType
			&& 'open-modal' != post.id
			&& document.body != post
		) {
			post = post.parentNode;
		}
		if (
				'tweet' != post.dataset.dragType
				&& 'open-modal' != post.id
			) {
			post = null;
		}
		else {
			response.tags += '#author:' + post.querySelector('.tweet-header .username').innerText.substring(1);
			if (request.instance.settings.mirror_tag) {
				response.tags += '#mirror:' + post.querySelector('.tweet-timestamp a').href;
			}
		}
		if ('mediaPreview' == target.rel && post) {
			let media_previews = post.querySelectorAll('[rel="mediaPreview"][' + request.attribute + '="' + response.uri + '"]');
			if (1 < media_previews.length) {
				alert('Unable to upload from non-expanded multi-sets, expand first');
				return false;
			}
			response.uri = target.style.backgroundImage.substring(5);
			let end_position = response.uri.indexOf('?');
			response.uri = response.uri.substring(0, end_position);
			request.attribute = 'src';
		}
		// twimg links videos with post info
		if (-1 != response.uri.search(/tweet_video/) && post) {
			// video
			let video = post.querySelector('video');
			if (video) {
				let src = video.getAttribute('src');
				if ('.mp4' == src.substring(src.length - 4)) {
					response.uri = src;
				}
				else {
					alert('Twitter post contains a non-mp4 video, unable to upload directly');
					return false;
				}
			}
		}
	}
	// twitter proper
	else if (-1 != window.location.host.search(/twitter.com/)) {
		console.log('twitter proper');
		site = 'twitter proper';
		post = target;
		// climb until we find the post container or the document body
		while (
			'tweet' != post.dataset.testid
			&& document.body != post
		) {
			// check if the tweet element is actually a direct child of the current element
			let children = post.children;
			let found = false;
			for (let child of children) {
				if ('tweet' == child.dataset.testid) {
					found = true;
					post = child;
					break;
				}
			}
			if (!found) {
				post = post.parentNode;
			}
		}
		if ('tweet' != post.dataset.testid) {
			post = null;
			alert('couldn\'t get tweet body for the target (if you have the target expanded try closing it and targetting the preview in the tweet');
			return false;
		}
		else {
			// author link is always first link in tweet
			let authorLink = post.firstChild.querySelector('a');
			response.tags += '#author:' + authorLink.href.split('/')[3];
			if (request.instance.settings.mirror_tag) {
				//TODO this doesn't work in status view
				//TODO but maybe works from user's profile view?
				//TODO or from timeline view?
				response.tags += '#mirror:' + post.querySelectorAll('[role=link]')[2].href;
			}
		}
		// trying to get video by targeting post link
		if ('link' == target.getAttribute('role')) {
			// start from parent to actual tweet
			// for status view
			let video = post.parentNode.querySelector('video');
			if (!video) {
				alert('tried to target video by tweet link but couldn\'t get video element\nmake sure you clicked the video to start it before attempting to upload');
				return false;
			}
			else if ('blob:' == video.src.substring(0, 5)) {
				alert('video element src was blob, use external service to scrape');
				return false;
			}
			response.uri = video.src;
		}
	}
	// pawoo
	else if (
		(
			document.querySelector('.brand') 
			&& 'https://pawoo.net/' == document.querySelector('.brand').href
		)
		|| (
			document.querySelector('.getting-started__footer p a')
			&& 'https://github.com/CrossGate-Pawoo/mastodon' == document.querySelector('.getting-started__footer p a').href
		)
	) {
		let postClass = '';
		if (
			document.querySelector('.brand') 
			&& 'https://pawoo.net/' == document.querySelector('.brand').href
		) {
			site = 'pawoo proper';
			postClass = 'entry';
		}
		else {
			site = 'pawoo web view';
			postClass = 'status';
		}
		if ('presentation' == target.getAttribute('role')) {
			alert('please close the expanded image to determine author for tagging');
			return false;
		}
		let post = target;
		// climb until we find the post container or the document body
		while (
			!post.classList.contains(postClass)
			&& document.body != post
		) {
			post = post.parentNode;
		}
		if (!post.classList.contains(postClass)) {
			post = null;
		}
		else {
			// get full size image
			if ('IMG' == target.tagName) {
				response.uri = target.parentNode.href;
			}
			// video or audio src
			else {
				response.uri = target.src;
			}
			let name = post.querySelector('.display-name__account').innerText.trim().substring(1);
			response.tags += '#author:' + name;
			if (request.instance.settings.mirror_tag) {
				response.tags += '#mirror:' + post.querySelector('.detailed-status__datetime u-url u-uid').href;
			}
		}
	}
	// other mastodon
	else if (
		document.querySelector('#mastodon')
		|| (
			document.querySelector('.column-4 a')
			&& 'https://github.com/tootsuite/mastodon' == document.querySelector('.column-4 a').href
		)
	) {
		let postClass = '';
		if (document.querySelector('#mastodon')) {
			site = 'mastodon web view';
			postClass = 'status';
		}
		else {
			site = 'mastodon proper';
			postClass = 'entry';
		}

		if ('presentation' == target.getAttribute('role')) {
			alert('please close the expanded image to determine author for tagging');
			return false;
		}
		let post = target;
		// climb until we find the post container or the document body
		while (
			!post.classList.contains(postClass)
			&& document.body != post
		) {
			post = post.parentNode;
		}
		if (!post.classList.contains(postClass)) {
			post = null;
		}
		else {
			// get full size image
			if ('IMG' == target.tagName) {
				response.uri = target.parentNode.href;
			}
			// video or audio src
			else {
				response.uri = target.src;
			}
			let name = post.querySelector('.display-name__account').innerText.trim().substring(1);
			response.tags += '#author:' + name;
			if (request.instance.settings.mirror_tag) {
				response.tags += '#mirror:' + post.querySelector('.detailed-status__datetime u-url u-uid').href;
			}
		}
	}
	// pixiv
	else if (-1 != window.location.host.search(/pixiv.net/)) {
		site = 'pixiv';
		response.reupload = true;
		if ('presentation' == target.parentNode.parentNode.parentNode.getAttribute('role')) {
			// targetting expanded, grab src of target
			response.uri = target.src;
		}
		else {
			// targetting non-expanded, grab href of parent link
			response.uri = target.parentNode.href;
		}
		// scrape user
		let authorAvatar = document.querySelector('aside section h2 a[data-gtm-value]');
		let authorName = authorAvatar.querySelector('div').title;
		let authorPixivID = authorAvatar.dataset.gtmValue;
		response.tags += '#author:' + authorName;
		response.tags += '#author:pixiv:' + authorPixivID;
		if (request.instance.settings.mirror_tag) {
			response.tags += '#mirror:' + document.head.querySelector('link [rel=canonical]').href;
		}
	}
	// discord
	else if (-1 != window.location.host.search(/cdn.discordapp/)) {
		site = 'discord';
		response.reupload = true;
	}

	// non-pawoo mastodon direct media always reupload
	if (
		'pawoo proper' != site
		&& 'pawoo web view' != site
		&& (
			-1 != response.uri.indexOf('system/cache/media_attachments/')
			|| -1 != response.uri.indexOf('media_attachments/files/')
		)
	) {
		console.log('mastodon media');
		response.reupload = true;
	}

	// pixiv direct media always reupload
	if (-1 != response.uri.indexOf('pximg.net')) {
		console.log('pixiv media');
		response.reupload = true;
	}

	// twimg links size upgrade
	if (-1 != response.uri.search(/twimg/) && -1 == response.uri.search(/tweet_video/)) {
		if ('src' == request.attribute) {
			// new twitter image format
			let format_pos = response.uri.indexOf('format=');
			if (-1 != format_pos) {
				let query_pos = response.uri.indexOf('?');
				let format_extension = response.uri.substring(format_pos + 7, format_pos + 10);
				let base_uri = response.uri.substring(0, query_pos);
				response.uri = base_uri + '.' + format_extension;
			}
			// get twitter orig image
			let formats = [
				':thumb',
				':small',
				':medium',
				':large',
				':orig',
			];
			for (let i in formats) {
				response.uri = response.uri.replace(formats[i], '');
			}
			response.uri += ':orig';
		}
	}

	// old tumblr image size upgrade
	if (
		-1 != response.uri.search(/media.tumblr.com/)
		&& -1 == response.uri.search(/va.media.tumblr.com/)
	) {
		// images
		if ('src' == request.attribute) {
			// get tumblr 1280 sizes for smaller versions specified
			let sizes = [75, 100, 250, 400, 500, 540]
			for (let i in sizes) {
				let size = sizes[i].toString();
				let filename_size_length = size.length + 5;
				let current_filename_suffix = response.uri.substring(response.uri.length - filename_size_length);
				let extensions = ['png', 'jpg', 'gif'];
				for (let j in extensions) {
					let extension = extensions[j];
					if ('_' + size + '.' + extension == current_filename_suffix) {
						response.uri = response.uri.substring(0, response.uri.length - filename_size_length) + '_1280.' + extension;
						break;
					}
				}
			}
		}
	}

	console.log('persephone upload get_target response:');
	console.log('  response uri: ' + response.uri);
	console.log('  response tags: ' + response.tags.toString());
	console.log('  response reupload: ' + response.reupload);

	// all sites besides pixiv send response directly
	if ('pixiv' != site) {
		sendResponse(response);
		return true;
	}
	// pixiv needs manual interface
	else {
		// pixiv makes submitting fetch requests with
		// third party credentials difficult somehow
		// so it's difficult to automate anything
		let pm = document.createElement('div');
		pm.id = 'pixiv-manual-download-reupload';
		pm.innerHTML = '<ol><li>Right click > "Save link as..." the first link</li><li>Download the full-res target to a temporary location (remember to delete it later)</li><li>Copy the tags from the additional tags input</li><li>Open the link to the persephone uploader</li><li>Open the advanced menu and paste the tags into the additional tags field</li><li>Attach the file you just downloaded</li><li>Close the upload after it finishes</li><li>Click "Close this overlay" on this page</li></ol>';

		let targetLink = document.createElement('a');
		targetLink.href = response.uri;
		targetLink.innerText = '"Right click" > "Save link as..." to download full-res target';
		pm.appendChild(targetLink);
		pm.appendChild(document.createElement('br'));

		let tagsInput = document.createElement('input');
		tagsInput.type = 'text';
		tagsInput.value = response.tags;
		pm.appendChild(tagsInput);
		pm.appendChild(document.createElement('br'));

		let persephoneLink = document.createElement('a');
		persephoneLink.href = request.instance.uri + '/media/upload';
		persephoneLink.target = '_blank';
		persephoneLink.innerText = 'persephone upload page';
		pm.appendChild(persephoneLink);
		pm.appendChild(document.createElement('br'));

		let closeLink = document.createElement('a');
		closeLink.innerText = 'Close this overlay';
		closeLink.style.cursor = 'pointer';
		closeLink.style.textDecoration = 'underline';
		closeLink.addEventListener('click', e => {
			document.body.removeChild(pm);
		});
		pm.appendChild(closeLink);

		document.body.insertBefore(pm, document.body.firstChild);
	}
});
