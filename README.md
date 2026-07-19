Pinpoint RCA is an AI-powered root cause assistant for CI/CD pipelines.

When a build or deployment fails, engineers usually spend time digging through 
raw logs to figure out what went wrong, often re-solving problems that have 
already happened before. Pinpoint automates that first step.

It parses failure logs, generates a plain-English explanation of the error, 
and checks past incidents for a similar failure using vector similarity search. 
If a match is found, it surfaces the fix that worked last time. Every new 
failure gets saved back into the system, so the tool gets more useful the 
more it's used.

Built with Node.js, React, MongoDB, and OpenAI's embedding and chat APIs.
