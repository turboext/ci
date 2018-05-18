const github = require('./github');
const { URL } = require('url');

const separator = '<span id="turbo-content-start"></span>';
const line = '\n****\n';

function getURLs(str, pull) {
    const re = /https:\/\/yandex\.ru\/turbo\?text=[^\s|)]+/g;

    const match = str.match(re);

    if (!Array.isArray(match)) {
        return [];
    }

    const examples = [
        'https://yandex.ru/turbo?text=https://rozhdestvenskiy.ru/',
        'https://yandex.ru/turbo?text=[URL]'
    ];

    return match.filter(url => !examples.includes(url)).map(url => {
        try {
            const before = new URL(url);
            before.hostname = 'master.turboext.net';

            const after = new URL(url);
            after.hostname = `pull-${pull}.turboext.net`;

            const text = before.searchParams.get('text');

            return {
                text,
                before: before.toString(),
                beforeFrame: before.toString().replace('/turbo', '/frame'),
                after: after.toString(),
                afterFrame: after.toString().replace('/turbo', '/frame')
            };
        } catch(e) {
            return false;
        }
    }).filter(Boolean);
}

module.exports = async function githubTask(payload) {
    try {
        const number = payload.pull_request.number;

        const search = {
            owner: 'turboext',
            repo: 'css',
            number
        };

        const { data } = await github.pullRequests.get(search);

        const original = data.body ? data.body.split(separator)[0] : '';

        const beta = `🚀 [master](https://master.turboext.net)\n🚀 [pull request](https://pull-${number}.turboext.net)`;
        const beautify = url => {
            return [
                url.text,
                `🚀 [master](${url.before}) [master iframe](${url.beforeFrame})`,
                `🚀 [PR](${url.after}) [PR iframe](${url.afterFrame})\n`
            ].join('\n');
        };

        const urls = getURLs(original, number);

        const body = [
            original.trim(),
            separator,
            line,
            urls.length ? urls.map(beautify).join('\n') : beta
        ].join('\n');

        return await github.pullRequests.update({...search, body});
    } catch (e) {
        console.error(e);
    }
};
