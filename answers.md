# Technical Test Answers

## Question 1: Production Readiness Plan

Here's what I think we need to make this project production-ready:

### 1. Code Quality & Testing
- Add unit tests for API endpoints
- Add integration tests for DB operations
- Convert to TypeScript
- Setup Github Actions CI/CD
- Add Swagger docs for the API

### 2. Security
- Add auth system (JWT probably)
- Add rate limiting
- Setup CORS properly
- Enable HTTPS
- Add input sanitization
- Better error handling (no stack traces in prod)
- API keys management

### 3. Database
- Switch to PostgreSQL (SQLite isn't production-ready)
- Better migration strategy
- Connection pooling
- Regular backups
- Data validation

### 4. Environment & Config
- Use env vars (dotenv)
- Setup dev/staging/prod environments
- Validate config on startup
- Add proper logging (Winston looks good)
- Setup monitoring (maybe Datadog?)
- Health check endpoint

### 5. Performance
- Add Redis caching ? Maybe overkill depending on the use case, postgres with indexes should be enough
- Add pagination (current endpoints return everything)
- Query optimization (indexes, etc)
- Load balancer setup
- Handle timeouts properly
- Add compression
- Monitor performance

### 6. Infrastructure
- Use Cloudflare Workers
- Setup basic monitoring
- Auto backups of DB
- SSL through Cloudflare

### 7. Docs
- API docs
- Deployment guide
- DB schema docs
- Troubleshooting guide
- Version changelog

## Question 2: Automating Daily File Ingestion

Here's my plan to automate the daily file imports:

### Current Issues
- Everything is manual right now (button in the UI)
- No way to know if imports fail
- Files could be broken/missing and we wouldn't know
- Need to click the button every day

### Proposed Solution

1. **Cloudflare Workers**
   - Use their Cron Triggers for scheduling 
   - Worker runs once a day to grab files from S3
   - Calls our API to do the actual import
   - Can retry if something fails
   - Sends a message to Slack when things go wrong

2. **API Changes Needed**
   - Track versions of imports (in case we need to rollback)
   - Keep history of what we imported
   - Better validation
   - Handle errors better

3. **Monitoring**
   - Use Cloudflare's built-in analytics:
     - See if worker ran ok
     - Track success/fails
     - How long it takes
   - Set up alerts

4. **Basic Architecture**

The flow would be:

```
S3 Bucket -> Cloudflare Worker -> Our API -> DB
                    |
                    v
              Slack webhook
```

5. **Error Handling**
   - Retry up to 3 times if something fails
   - Keep old data if new import breaks
   - Ping the team in Slack if things go wrong