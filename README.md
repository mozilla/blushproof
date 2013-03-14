For users: https://github.com/mozilla/blushproof/wiki

For developers:
To checkout:  
    `git clone https://github.com/mozilla/blushproof`  
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
