const octokit = require('@octokit/rest')();

octokit.authenticate({
    type: 'token',
    token: process.env.GITHUB_OAUTH_TOKEN
});

module.exports = octokit;
