// gitService.js
const simpleGit = require('simple-git');

export default class GitService
{
    constructor(repoPath)
    {
        this.git = simpleGit(repoPath);
    }

    async init()
    {
        await this.git.init();
    }

    async add(filePath)
    {
        await this.git.add(filePath);
    }

    async commit(message)
    {
        await this.git.commit(message);
    }

    async push()
    {
        await this.git.push();
    }

    async pull()
    {
        await this.git.pull();
    }

    async status()
    {
        return await this.git.status();
    }

    async log()
    {
        return await this.git.log();
    }
}

