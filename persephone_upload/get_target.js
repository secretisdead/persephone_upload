'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if ('get_target' != request.message) {
		return false;
	}
	let instance = request.instance;

	let site = '';
	if (-1 != window.location.host.search(/tumblr/)) {
		site = 'tumblr';
	}
	else if (-1 != window.location.host.search(/tweetdeck/)) {
		site = 'tweetdeck';
	}
	else if (-1 != window.location.host.search(/twitter/)) {
		site = 'twitter';
	}

	let attribute = request.attribute;
	let uri = request.uri;
	let tags = '';
	let post = null;
	let target = document.querySelector('[' + attribute + '="' + uri + '"]');
	if ('tumblr' == site) {
		post = target;
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
			if (source) {
					let peepr = JSON.parse(source.dataset.peepr);
					tags += '#author:' + peepr.tumblelog;
					if (instance.settings.mirror_tag) {
						tags += '#mirror:http://' + peepr.tumblelog + '.tumblr.com/post/' + peepr.postId;
					}
			}
			else if (instance.settings.mirror_tag) {
				tags += '#mirror:' + 'http://' + post.dataset.tumblelog + '.tumblr.com/post/' + post.dataset.id;
			}
		}
	}
	else if ('tweetdeck' == site) {
		post = target;
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
			tags += '#author:' + post.querySelector('.tweet-header .username').innerText.substring(1);
			if (instance.settings.mirror_tag) {
				tags += '#mirror:' + post.querySelector('.tweet-timestamp a').href;
			}
		}
		if ('mediaPreview' == target.rel && post) {
			let media_previews = post.querySelectorAll('[rel="mediaPreview"][' + attribute + '="' + uri + '"]');
			if (1 < media_previews.length) {
				alert('Unable to upload from non-expanded multi-sets, expand first');
				return false;
			}
			uri = target.style.backgroundImage.substring(5);
			let end_position = uri.indexOf('?');
			uri = uri.substring(0, end_position);
			attribute = 'src';
		}
	}
	else if ('twitter' == site) {
		if (!target) {
			// viewing single tweet from permalink overlay
			if (document.querySelector('#permalink-overlay-dialog')) {
				target = document.querySelector('#permalink-overlay-dialog .tweet');
			}
			else {
				let uri = request.uri;
				uri = uri.replace('http://twitter.com', '');
				uri = uri.replace('https://twitter.com', '');
				target = document.querySelector('[' + attribute + '="' + uri + '"]');
			}
		}
		post = target;
		while (
			!post.classList.contains('tweet')
			&& (
				!post.classList.contains('Gallery')
				|| !post.classList.contains('with-tweet')
			)
			&& document.body != post
		) {
			post = post.parentNode;
		}
		if (
				!post.classList.contains('tweet')
				&& (
					!post.classList.contains('Gallery')
					|| !post.classList.contains('with-tweet')
				)
			) {
			post = null;
		}
		else {
			let post_container = post;
			if (!post.classList.contains('tweet')) {
				post = post.querySelector('.tweet');
			}
			tags += '#author:' + post.dataset.screenName;
			if (instance.settings.mirror_tag) {
				tags += '#mirror:https://twitter.com' + post.dataset.permalinkPath;
			}
			post = post_container;
		}
	}

	if ('src' == attribute) {
		if ('tumblr' == site) {
			// get tumblr 1280 sizes for smaller versions specified
			let sizes = [75, 100, 250, 400, 500, 540]
			for (let i in sizes) {
				let size = sizes[i].toString();
				let filename_size_length = size.length + 5;
				let current_filename_suffix = uri.substring(uri.length - filename_size_length);
				let extensions = ['png', 'jpg', 'gif'];
				for (let j in extensions) {
					let extension = extensions[j];
					if ('_' + size + '.' + extension == current_filename_suffix) {
						uri = uri.substring(0, uri.length - filename_size_length) + '_1280.' + extension;
						break;
					}
				}
			}
		}
		else if (-1 != uri.search(/twimg/) && -1 == uri.search(/tweet_video/)) {
			// get twitter orig image
			let formats = [
				':thumb',
				':small',
				':medium',
				':large',
			];
			for (let i in formats) {
				uri = uri.replace(formats[i], '');
			}
			uri += ':orig';
		}
	}
	else if (post) {
		if ('tumblr' == site) {
			// direct video
			if (post.classList.contains('is_direct_video')) {
				let video_source = post.querySelector('video>source');
				if (video_source) {
					uri = video_source.getAttribute('src');
				}
			}
		}
		else if ('tweetdeck' == site || 'twitter' == site) {
			// video
			let video = post.querySelector('video');
			if (video) {
				let src = video.getAttribute('src');
				if ('.mp4' == src.substring(src.length - 4)) {
					uri = src;
				}
				else {
					alert('Twitter post contains a non-mp4 video, unable to upload directly');
					uri = '';
				}
			}
		}
		else {
			uri = request.uri;
		}
	}

	sendResponse({
		message: 'upload_target',
		uri: uri,
		tags: tags,
	});
	return true;
});
