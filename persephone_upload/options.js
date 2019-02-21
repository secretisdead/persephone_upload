'use strict';

let add_form = document.querySelector('#add_form');
let instances_form = document.querySelector('#instances_form');

function add_instance() {
	let title_input = add_form.querySelector('#title');
	let uri_input = add_form.querySelector('#uri');
	let title = title_input.value;
	let uri = uri_input.value.replace(/\/*$/, '');
	chrome.storage.sync.get(['instances'], (data) => {
		let instances = [];
		if (data.instances) {
			instances = JSON.parse(data.instances);
		}
		for (let i = 0; i < instances.length; i++) {
			if (title == instances[i].title) {
				alert('An instance with the specified title already exists, edit it below');
				return;
			}
			if (uri == instances[i].uri) {
				alert('An instance with the specified URI already exists, edit it below');
				return;
			}
		}
		let new_instance = {
			title: title,
			uri: uri,
			settings: {
				generate_summaries: true,
				owner_id: '',
				searchability: 'hidden',
				protection: 'none',
				creation_date: '',
				tags: '',
			},
		};
		instances.push(new_instance);
		title_input.value = '';
		uri_input.value = '';
		chrome.storage.sync.set({'instances': JSON.stringify(instances)}, () => {
			update_instance_containers();
			refresh_context_menus();
		});
	});
}

function save_instances() {
	let instances = [];
	let instance_containers = document.querySelectorAll('.instance_container');
	for (let i = 0; i < instance_containers.length; i++) {
		instances.push(instance_containers[i].instance);
	}
	chrome.storage.sync.set({'instances': JSON.stringify(instances)}, () => {
		refresh_context_menus();
	});
}

function refresh_context_menus() {
	chrome.runtime.sendMessage({
		message: 'refresh_context_menus',
	});
}

function change_instance_checkbox_setting(e) {
	let field = e.currentTarget.dataset.field;
	if (e.currentTarget.checked) {
		e.currentTarget.parentNode.instance.settings[field] = 1;
	}
	else {
		e.currentTarget.parentNode.instance.settings[field] = 0;
	}
}

function change_instance_text_setting(e) {
	let value = e.currentTarget.value;
	e.currentTarget.parentNode.instance.settings[e.currentTarget.dataset.field] = value;
}

function change_instance_select_setting(e) {
	let value = e.currentTarget.options[e.currentTarget.selectedIndex].value;
	e.currentTarget.parentNode.instance.settings[e.currentTarget.dataset.field] = value;
}

function create_instance_container(instance) {
	let instance_container = document.createElement('div');
	instance_container.classList.add('instance_container');
	instance_container.instance = instance;

	instance_container.appendChild(document.createElement('hr'));

	let remove = document.createElement('a');
	remove.innerText = 'Remove this instance';
	remove.style.display = 'block';
	remove.style.textAlign = 'right';
	remove.style.color = 'blue';
	remove.style.textDecoration = 'underline';
	remove.style.cursor = 'pointer';
	remove.addEventListener('click', e => {
		e.preventDefault();
		e.currentTarget.parentNode.parentNode.removeChild(e.currentTarget.parentNode);
		save_instances();
		return;
	});
	instance_container.appendChild(remove);

	let title_label = document.createElement('label');
	title_label.innerText = 'Context submenu title';
	let title_input = document.createElement('input');
	title_input.type = 'text';
	title_input.value = instance.title;
	title_input.addEventListener('change', e => {
		e.currentTarget.parentNode.instance.title = e.currentTarget.value;
	});
	instance_container.appendChild(title_label);
	instance_container.appendChild(title_input);
	instance_container.appendChild(document.createElement('br'));

	let uri_label = document.createElement('label');
	uri_label.innerText = 'Instance URI (including protocol)';
	let uri_input = document.createElement('input');
	uri_input.type = 'text';
	uri_input.value = instance.uri;
	uri_input.addEventListener('change', e => {
		e.currentTarget.parentNode.instance.uri = e.currentTarget.value;
	});
	instance_container.appendChild(uri_label);
	instance_container.appendChild(uri_input);
	instance_container.appendChild(document.createElement('br'));

	let generate_summaries_label = document.createElement('label');
	generate_summaries_label.innerText = 'Generate summaries';
	let generate_summaries_input = document.createElement('input');
	generate_summaries_input.type = 'checkbox';
	generate_summaries_input.dataset.field = 'generate_summaries';
	if (instance.settings.generate_summaries) {
		generate_summaries_input.checked = true;
	}
	generate_summaries_input.addEventListener('change', change_instance_checkbox_setting);
	instance_container.appendChild(generate_summaries_label);
	instance_container.appendChild(generate_summaries_input);
	instance_container.appendChild(document.createElement('br'));

	let filename_tag_label = document.createElement('label');
	filename_tag_label.innerText = 'Filename tag';
	let filename_tag_input = document.createElement('input');
	filename_tag_input.type = 'checkbox';
	filename_tag_input.dataset.field = 'filename_tag';
	if (instance.settings.filename_tag) {
		filename_tag_input.checked = true;
	}
	filename_tag_input.addEventListener('change', change_instance_checkbox_setting);
	instance_container.appendChild(filename_tag_label);
	instance_container.appendChild(filename_tag_input);
	instance_container.appendChild(document.createElement('br'));

	let owner_id_label = document.createElement('label');
	owner_id_label.innerText = 'Owner ID';
	let owner_id_input = document.createElement('input');
	owner_id_input.type = 'text';
	owner_id_input.dataset.field = 'owner_id';
	owner_id_input.value = instance.settings.owner_id;
	owner_id_input.addEventListener('change', change_instance_text_setting);
	instance_container.appendChild(owner_id_label);
	instance_container.appendChild(owner_id_input);
	instance_container.appendChild(document.createElement('br'));

	let searchability_label = document.createElement('label');
	searchability_label.innerText = 'Searchability';
	let searchability_input = document.createElement('select');
	searchability_input.dataset.field = 'searchability';
	let searchability_options = {
		'hidden': 'Hidden',
		'groups': 'Groups',
		'public': 'Public',
	};
	for (let value in searchability_options) {
		let option = document.createElement('option');
		option.value = value;
		option.innerText = searchability_options[value];
		searchability_input.appendChild(option);
	}
	for (let i = 0; i < searchability_input.options.length; i++) {
		if (instance.settings.searchability == searchability_input.options[i].value) {
			searchability_input.selectedIndex = i;
			break;
		}
	}
	searchability_input.addEventListener('change', change_instance_select_setting);
	instance_container.appendChild(searchability_label);
	instance_container.appendChild(searchability_input);
	instance_container.appendChild(document.createElement('br'));

	let protection_label = document.createElement('label');
	protection_label.innerText = 'Protection';
	let protection_input = document.createElement('select');
	protection_input.dataset.field = 'protection';
	let protection_options = {
		'none': 'None',
		'groups': 'Groups',
		'private': 'Private',
	};
	for (let value in protection_options) {
		let option = document.createElement('option');
		option.value = value;
		option.innerText = protection_options[value];
		protection_input.appendChild(option);
	}
	for (let i = 0; i < protection_input.options.length; i++) {
		if (instance.settings.protection == protection_input.options[i].value) {
			protection_input.selectedIndex = i;
			break;
		}
	}
	protection_input.addEventListener('change', change_instance_select_setting);
	instance_container.appendChild(protection_label);
	instance_container.appendChild(protection_input);
	instance_container.appendChild(document.createElement('br'));

	let creation_date_label = document.createElement('label');
	creation_date_label.innerText = 'Creation date';
	let creation_date_input = document.createElement('input');
	creation_date_input.type = 'text';
	creation_date_input.dataset.field = 'creation_date';
	creation_date_input.value = instance.settings.creation_date;
	creation_date_input.addEventListener('change', change_instance_text_setting);
	instance_container.appendChild(creation_date_label);
	instance_container.appendChild(creation_date_input);
	instance_container.appendChild(document.createElement('br'));

	let tags_label = document.createElement('label');
	tags_label.innerText = 'Tags';
	let tags_input = document.createElement('input');
	tags_input.type = 'text';
	tags_input.dataset.field = 'tags';
	tags_input.value = instance.settings.tags;
	tags_input.addEventListener('change', change_instance_text_setting);
	instance_container.appendChild(tags_label);
	instance_container.appendChild(tags_input);
	instance_container.appendChild(document.createElement('br'));

	return instance_container;
}

function update_instance_containers() {
	let instance_containers = document.querySelector('#instance_containers')
	instance_containers.innerHTML = '';
	chrome.storage.sync.get(['instances'], (data) => {
		if (!data.instances) {
			instances_form.style.display = 'none';
			return;
		}
		instances_form.style.display = '';
		let instances = JSON.parse(data.instances);
		if (0 < instances.length) {
			for (let i = 0; i < instances.length; i++) {
				instance_containers.appendChild(create_instance_container(instances[i]));
			}
		}
	});
}

add_form.addEventListener('submit', e => {
	e.preventDefault();
	add_instance();
});

instances_form.addEventListener('submit', e => {
	e.preventDefault();
	save_instances();
});

document.querySelector('#clear').addEventListener('click', e => {
	chrome.storage.sync.remove('instances', () => {
		update_instance_containers();
		refresh_context_menus();
	});
});

update_instance_containers();
