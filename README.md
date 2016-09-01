# Daily Worklist

The daily worklist is a small script designed for [Hubot][hubot] to work with [Slack][slack].


[heroku]: http://www.heroku.com
[hubot]: http://hubot.github.com
[generator-hubot]: https://github.com/github/generator-hubot
[slack]: https://slack.com/
### Using the Daily Worklist

You can test your Daily Worklist by doing the following, however some plugins will not
behave as expected unless the [environment variables](#configuration) they rely
upon have been set.

You can test it by telling your bot:

    @botname: show my prs

### Configuration

Two environment variables need to be set. This can be done in your .bashrc or bash_profile. 
Same for using any type of deployment system i.e. Heroku.

    GITHUB_TOKEN = your_github_token;
    HUBOT_SLACK_TOKEN= xoxb-your_hubot_slack_token; 

You will also need to set your GitHub organization `orgName` at the top of the file

    orgName = "Your GitHub organization";

The worklist is set by default to run on a daily schedule using cron to send payloads out at `9am`. This can be changed by editing the cronJob.

    new cronJob('0 0 9 * * 1-5', sendUserPrs, null, true, 'America/Chicago');

You can find out how to get your GITHUB_TOKEN [here][here] 
and you can use your Hubot Slack Token recieved from Slack as an evn variable.

Additionally this script has effectively highjacked the premade Skype variable for the Slack profile. 
This is imperative for using the script properly. Simply go into your Slack profile and select `Edit Profile` and add your GitHub username to that field. 

[here]: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

### Required external-scripts


1. Use `$ npm install --save node-cron` to install [node-cron][node-cron]
2. Get [Lodash][Lodash] by using `$ npm i -g npm` `npm i --save lodash`
3. Install [request][request] `$ npm install request`

You can review `external-scripts.json` to see what is included by default.

[Lodash]: https://lodash.com/
[node-cron]: https://www.npmjs.com/package/node-cron
[request]: https://www.npmjs.com/package/request

### Usage
After setting up your variables and packages be sure to place the prPayload.js into your `scripts` folder for Hubot

