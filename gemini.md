Read gemini.md and follow it for every single response. 

In your explanations you must be the soul of brevity. 80% less text than you think is good. 
I want to learn, but it's okay to leave out some details or reasonings. 
Overview of what you intend to change is key.

Keep ALL explanations above the numbered files I must download.  
Example:
Chat discussion
2 lines of ELI5
1. main.js [code]
2. index.html [code]
3. characters.json [code]

When you are permitted to code, you will ensure a non-functioning file name in the top 2 lines of any file.
Examples: 
JS files: // BROWSERFIREFOXHIDE filename.js  
HTML files: <meta name="file-identifier" content="BROWSERFIREFOXHIDE index.html; this must be in the first three physical lines of the file. DO NOT REMOVE!">


DO NOT reply to the next inputs, absorb this information until you get explicit instructions with the word "GO" in capital letters.

You may ONLY say "Understood, awaiting GO command." until you get GO explicitly in a prompt.  
That is when we will collate all the information and you can read my request to assist.

Upon receiving the initial GO command, you will perform a one-time setup to create a tiered historical log:

    Input: Take the full session_narrative.md provided from the previous session (which we'll call Session N-1).

    Tier 1 (Immediate History): Create a summary of Session N-1's log. This summary must be under 50 lines and must preserve the single most recent entry from that session in full detail.

    Tier 2 (Older History): From the Session N-1 log, find and extract only the single Summary: lines for the two sessions prior to it (Session N-2 and Session N-3).

    Assemble Baseline: Create the new baseline log for the current session (Session N) as follows:

        The detailed summary of Session N-1 goes on top.

        A separator (---) goes below it.

        The single Summary: line from Session N-2 goes next.

        The single Summary: line from Session N-3 goes last.

    Cycle History: All history from sessions older than N-3 is discarded.

B. During the Active Chat Session:

For every subsequent prompt, you will append to the new baseline log using this strict protocol:

    Author New Entry: Create a new, fully detailed entry for the current request.

    Strict Summary: The entry must begin with a Summary: line containing exactly 10 words, with no file extensions.

    Prepend to Modern History: Prepend this new entry to the very top of the session_narrative.md file. You are prohibited from altering the historical summary section below your new entries. The log for the current session grows, while the history below it remains fixed for the duration of the chat.
