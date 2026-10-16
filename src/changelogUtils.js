import _ from 'lodash';
import got from 'got';

import {getModuleInfo} from './packageUtils';
import {getRepositoryInfo} from './repositoryUtils';

const pkg = require('../package.json');

const COMMON_CHANGELOG_FILES = ['CHANGELOG.md', 'History.md', 'HISTORY.md', 'CHANGES.md', 'CHANGELOG'];
const CURRENT_REPOSITORY_ID = getRepositoryInfo(pkg.repository.url).repositoryId;
const DEFAULT_REMOTE_CHANGELOGS_DB_URL =
  `https://raw.githubusercontent.com/${CURRENT_REPOSITORY_ID}/master/db/changelogUrls.json`;

export const fetchRemoteDb = _.memoize(async (url = DEFAULT_REMOTE_CHANGELOGS_DB_URL) => {
  try {
    // got >=10: `json` is the request body; use responseType to parse JSON responses.
    const response = await got(url, {responseType: 'json'});

    return response.body;
  } catch (err) {
    return null;
  }
});

/**
 * Check whether a URL is reachable without downloading the response body.
 * Falls back to GET when the host rejects HEAD (e.g. 405).
 */
async function urlExists(url) {
  try {
    const response = await got(url, {method: 'HEAD'});
    // Considering only 2xx codes as successful as e.g. GitLab returns 304 for missing files
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch (err) {
    const statusCode = err.response && err.response.statusCode;
    if (statusCode !== 405 && statusCode !== 501) {
      return false;
    }
  }

  try {
    const response = await got(url, {
      method: 'GET',
      headers: {Range: 'bytes=0-0'}
    });
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch (err) {
    return false;
  }
}

export async function findModuleChangelogUrl(moduleName, remoteChangelogUrlsDbUrl = DEFAULT_REMOTE_CHANGELOGS_DB_URL) {
  let changelogUrls;

  if (remoteChangelogUrlsDbUrl) {
    changelogUrls = await fetchRemoteDb(remoteChangelogUrlsDbUrl);
  }

  changelogUrls = changelogUrls || require('../db/changelogUrls.json');

  if (changelogUrls[moduleName]) {
    return changelogUrls[moduleName];
  }

  const {changelog, repository} = await getModuleInfo(moduleName);

  if (changelog) {
    return changelog;
  }

  if (repository && repository.url) {
    // If repository is located on one of known hostings, then we will try to request
    // some common changelog files from there or return URL for "Releases" page
    const {fileUrlBuilder, releasesPageUrl} = getRepositoryInfo(repository.url) || {};

    if (fileUrlBuilder) {
      // Prefer CHANGELOG.md and stop at the first hit; avoid downloading full file bodies.
      for (const filename of COMMON_CHANGELOG_FILES) {
        const url = fileUrlBuilder(filename);
        if (await urlExists(url)) {
          return url;
        }
      }
    }

    if (releasesPageUrl && await urlExists(releasesPageUrl)) {
      return releasesPageUrl;
    }
  }

  return null;
}
