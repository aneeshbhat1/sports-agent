import axios from 'axios';

const routes = {
	'/year/round/drivers/driverid': {
		optional: ['year', 'round', 'driverid'],
		required: []
	},
	'/year/round/constructors/constructorid': {
		optional: ['year', 'round', 'constructorid'],
		required: []
	},
	'/year/round/circuits/circuitid': {
		optional: ['year', 'round', 'circuitid'],
		required: []
	},
	'/seasons': {
		optional: [],
		required: []
	},
	'/year/round': {
		optional: ['year', 'round'],
		required: []
	},
	'/year/round/driverStandings': {
		optional: ['year', 'round'],
		required: []
	},
	'/year/round/constructorStandings': {
		optional: ['year', 'round'],
		required: []
	},
	'/year/round/status': {
		optional: ['year', 'round'],
		required: []
	},
	'/year/round/laps/lapnumber': {
		optional: ['year', 'round', 'lapnumber'],
		required: []
	},
	'/year/round/pitstops/pitstopnumber': {
		optional: ['year', 'round', 'pitstopnumber'],
		required: []
	}
};


export const handler = async (event) => {
	console.log('Input info:' + JSON.stringify(event, undefined, 2));

	const apiPath = event.apiPath;
	let response;

	const route = routes[apiPath];
	if (route) {
		const modifiedPath = modifyPath(apiPath, event.parameters, route.optional, route.required);
		response = await getDataFromAPI(modifiedPath);
	} else {
		throw new Error(`Unsupported API path: ${apiPath}`);
	}

	let result = {
		messageVersion: '1.0',
		response: {
			actionGroup: event.actionGroup,
			apiPath: event.apiPath,
			httpMethod: event.httpMethod,
			httpStatusCode: 200,
			responseBody: {
				'application/json': {
					body: response,
				},
			},
			sessionAttributes: {},
			promptSessionAttributes: {},
		},
	};

	console.log(result);
	return result;
};

function modifyPath(apiPath, parameters, optional, required) {
	let modifiedPath = apiPath;

	// Replace parameters in the path
	parameters.forEach(param => {
		modifiedPath = modifiedPath.replace(param.name, param.value);
	});

	// Remove optional parameters if not provided
	optional.forEach(param => {
		if (!containsParameter(parameters, param)) {
			modifiedPath = modifiedPath.replace(`/${param}`, '');
		}
	});

	// Ensure all required parameters are present
	required.forEach(param => {
		if (!containsParameter(parameters, param)) {
			throw new Error(`Missing required parameter: ${param}`);
		}
	});

	return modifiedPath;
}

function containsParameter(parameters, name) {
	return parameters.some((parameter) => parameter.name === name);
}

async function getDataFromAPI(apiPath) {
	const url = `http://ergast.com/api/f1${apiPath}`;

	console.log(url);

	try {
		const response = await axios.get(url);
		console.log(response.data);
		return response.data;
	} catch (error) {
		console.error('Error fetching data:', error);
		throw error;
	}
}
