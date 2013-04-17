For users: https://github.com/mozilla/blushproof/wiki

For developers:
Requirements: nodejs, volo version 0.2.8 or higher

To checkout:  
    `npm install -g volo`
    `git clone https://github.com/mozilla/blushproof`  
    `cd blushproof`
    `volo add micropilot packages/micropilot`
    `cd .git`  
    `rm -rf hooks`  
    `ln -s ../hooks .`

To work:  
    `git checkout -b <your-branch-name>`  
    `<do your work>`  
    `git add <files-you-edited>`  
    `git commit -m <concise-yet-complete-description>`  

To run:  
    `cfx -b <path-to-nightly> -p <profile-dir> run`

Setting the profile_dir is necessary when testing functionality across
restarts.

Style guidelines: [http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml](http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml)
