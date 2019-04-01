import log from '../../logger';
import config from '../../config';
import arboristClient from './arboristClient';

const authMWResolver = async (resolve, root, args, context, info) => {
  const { jwt } = context;

  // if mock arborist endpoint, just skip auth middleware
  if (config.arboristEndpoint === 'mock') {
    log.debug('[authMiddleware] using mock arborist endpoint, skip auth middleware');
    return resolve(root, args, context, info);
  }

  // asking arborist for auth resource list, and add to filter args
  const resources = await arboristClient.listAuthorizedResources(jwt);
  log.debug('[authMiddleware] add limitation for field ', config.esConfig.authFilterField, ' within resources: ', resources);
  if (resources && resources.length > 0) {
    const parsedFilter = args.filter || {};
    const newArgs = {
      ...args,
      filter: {
        AND: [
          parsedFilter,
          {
            IN: [
              config.esConfig.authFilterField,
              [...resources],
            ],
          },
        ],
      },
    };
    return resolve(root, newArgs, context, info);
  }

  // if no resources accessable, just return empty result
  return Promise.resolve([]);
};

// apply this middleware to all es types' data/aggregation resolvers
const typeMapping = config.esConfig.indices.reduce((acc, item) => {
  acc[item.type] = authMWResolver;
  return acc;
}, {});
const authMiddleware = {
  Query: {
    ...typeMapping,
  },
  HistogramForNumber: authMWResolver,
  HistogramForString: authMWResolver,
};

export default authMiddleware;
