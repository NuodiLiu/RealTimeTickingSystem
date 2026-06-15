# Real-Time Ticketing System — Frontend Regression Tests

This module contains the automated UI regression suite for the **Real-Time Ticketing System** frontend (`/frontend`, a Next.js 15 app served on `http://localhost:3001` by default).

It is modelled on the `solutions-automated-tests/serenity-cucumber` suite and uses the same toolchain:

- **Serenity BDD 4.x** (Screenplay pattern)
- **Cucumber 7** with Gherkin `.feature` files
- **JUnit 5 / JUnit Platform Suite**
- **Maven** build (`mvn verify`)
- **Selenium WebDriver** via WebDriverManager (auto-downloads Chrome driver)

## Pre-requisites

- **JDK 21** (set `JAVA_HOME` and put `%JAVA_HOME%/bin` on `PATH`)
- **Maven 3.9+** (set `MAVEN_HOME` and put `%MAVEN_HOME%/bin` on `PATH`)
- **Chrome / Chromium** (driver auto-downloaded)
- **The frontend running locally**, e.g.

  ```bash
  cd ../frontend
  npm install
  npm run dev   # serves on http://localhost:3001
  ```

  The backend (`../backend`) should also be reachable so that `/dashboard` and `/public-display` can render real data.

## Project layout

Standard Maven / Serenity layout:

```
frontend-tests
├── pom.xml
├── serenity.properties
├── README.md
└── src
    └── test
        ├── java/realtimeticketing
        │   ├── CucumberTestSuite.java         # JUnit/Cucumber runner
        │   ├── authentication/Login.java      # Microsoft SSO Screenplay task
        │   ├── navigation/                    # (reserved)
        │   ├── pageobjects/                   # Lean page-object Targets
        │   │   ├── LoginPage.java
        │   │   ├── DashboardPage.java
        │   │   ├── PublicDisplayPage.java
        │   │   ├── HeaderComponent.java
        │   │   └── SSO_SignIn.java
        │   ├── questions/                     # Screenplay Questions
        │   │   ├── PageTitle.java
        │   │   └── CurrentUrl.java
        │   ├── stepdefinitions/               # Cucumber glue
        │   │   ├── Hooks.java
        │   │   ├── ParameterDefinitions.java
        │   │   ├── NavigationStepDefinitions.java
        │   │   ├── LoginStepDefinitions.java
        │   │   ├── DashboardStepDefinitions.java
        │   │   └── PublicDisplayStepDefinitions.java
        │   ├── tasks/NavigateTo.java          # Screenplay navigation tasks
        │   └── utils/DataTableUtils.java
        └── resources
            ├── serenity.conf                  # WebDriver + environment URLs
            ├── junit-platform.properties
            ├── logback-test.xml
            └── features                       # Cucumber feature files
                ├── Login.feature
                ├── Dashboard.feature
                ├── AdminDashboard.feature
                ├── PublicDisplay.feature
                └── Navigation.feature
```

## Cloud setup (one-time)

The CI workflow [`.github/workflows/frontend-tests-e2e.yml`](../.github/workflows/frontend-tests-e2e.yml) reads the Microsoft test-account credentials from two GitHub repo secrets — `MS_USERNAME` and `MS_PASSWORD`. Set them once via the `gh` CLI:

```bash
gh secret set MS_USERNAME --repo NuodiLiu/RealTimeTickingSystem --body "you@outlook.com"
gh secret set MS_PASSWORD --repo NuodiLiu/RealTimeTickingSystem  # prompts securely
```

The backend currently has `AZURE_AD_ALLOW_ANY_TENANT=true`, so any Microsoft account (personal `@outlook.com` / `@hotmail.com` or any AAD tenant member) can be used as the test account.

## Pages under test

| Page             | Route             | Purpose                                                            |
|------------------|-------------------|--------------------------------------------------------------------|
| Login            | `/login`          | Microsoft Azure-AD sign-in entry point                             |
| Dashboard        | `/dashboard`      | Staff workspace: Queue, My Active Cases, iPad Devices              |
| Public Display   | `/public-display` | Public-facing waiting queue shown on the kiosk monitor (no auth)   |
| Home (redirect)  | `/`               | Immediately redirects to `/dashboard`                              |

## Running the tests

From this directory:

```bash
mvn clean verify
```

By default this runs against the **local** environment configured in `src/test/resources/serenity.conf` (`http://localhost:3001`).

### Selecting an environment

```bash
mvn clean verify -Denvironment=local      # default — http://localhost:3001
mvn clean verify -Denvironment=test       # https://test-ticketing.example.com
mvn clean verify -Denvironment=staging    # https://staging-ticketing.example.com
```

Edit `src/test/resources/serenity.conf` to point `test` / `staging` at the URLs that are actually deployed.

### Filtering by tag

The feature files use a consistent tagging scheme:

| Tag              | Meaning                                            |
|------------------|----------------------------------------------------|
| `@Smoke`         | Minimum smoke set, expected to always pass         |
| `@Regression`    | Full regression suite                              |
| `@Login`         | Login / SSO flows                                  |
| `@Dashboard`     | Authenticated dashboard layout & controls          |
| `@Admin`         | Admin-only UI (e.g. Export to Excel)               |
| `@Staff`         | Standard staff visibility checks                   |
| `@PublicDisplay` | Public kiosk display                               |
| `@Navigation`    | Route redirects / auth guards                      |
| `@SSO`           | Scenarios that actually drive the Microsoft login  |

Examples:

```bash
mvn clean verify "-Dcucumber.filter.tags=@Smoke"
mvn clean verify "-Dcucumber.filter.tags=@Login and not @SSO"
mvn clean verify "-Dcucumber.filter.tags=@PublicDisplay"
```

### Microsoft SSO credentials

Scenarios tagged `@SSO`, `@Dashboard`, or `@Admin` drive a real Microsoft login. Provide credentials via system properties (preferred) or environment variables:

```bash
mvn clean verify \
  "-Dcucumber.filter.tags=@Dashboard" \
  -DusernameMS="firstname.lastname@unswcollege.edu.au" \
  -DpasswordMS="********"
```

or:

```bash
export MS_USERNAME="firstname.lastname@unswcollege.edu.au"
export MS_PASSWORD="********"
mvn clean verify "-Dcucumber.filter.tags=@Dashboard"
```

Scenarios without these tags (`@PublicDisplay`, `@Navigation`, and the non-SSO `@Login` scenarios) **do not** require credentials and can be run anonymously.

## Running from the IDE

Open the project in IntelliJ IDEA → run **`CucumberTestSuite`** (under `src/test/java/realtimeticketing/`).
You can also right-click any `.feature` file and choose **Run**.

## Reports

Serenity reports are aggregated automatically during `mvn verify`. Open:

```
target/site/serenity/index.html
```

A single-page summary is also produced (configured in `pom.xml` via the `serenity-single-page-report` dependency).

## Adding a new test

1. Add or extend a `.feature` file under `src/test/resources/features` using Gherkin syntax.
2. If a new step phrasing is introduced, add a method in the appropriate `*StepDefinitions` class.
3. For new pages or components, add a `Target`-based page object under `pageobjects/`.
4. For new reusable flows, add a Screenplay Task under `tasks/` (or an authentication helper under `authentication/`).

## Handoff checklist (for the team taking over)

The suite was developed against a single dev's machine + a placeholder `test` / `staging` config. When the receiving team has a real deployed test environment and a dedicated test account, do these three steps:

### 1. Replace the `test` / `staging` URLs in `serenity.conf`

[`src/test/resources/serenity.conf`](src/test/resources/serenity.conf) currently has `example.com` placeholders:

```hocon
test {
  frontend.url = "https://test-ticketing.example.com"      # ← replace
  backend.url  = "https://api-test-ticketing.example.com"  # ← replace
  environment = 'test'
}
staging {
  frontend.url = "https://staging-ticketing.example.com"      # ← replace
  backend.url  = "https://api-staging-ticketing.example.com"  # ← replace
  environment = 'staging'
}
```

The `local` block (lines 27-35) is for the original dev's machine — leave it alone or repurpose for your local-dev URLs.

### 2. Rotate the GitHub secrets to a team-owned test account

```bash
gh secret set MS_USERNAME --repo <your-org>/<your-repo> --body "svc-ticketing-tests@<yourtenant>"
gh secret set MS_PASSWORD --repo <your-org>/<your-repo>      # prompts securely
```

Requirements for the test account:
- Lives in the same Azure AD tenant the backend authorises (or backend has `AZURE_AD_ALLOW_ANY_TENANT=true`)
- Has whichever roles your `@Dashboard` / `@Admin` scenarios assume (typically a `STAFF` + an `ADMIN` user)
- **MFA disabled / exempted** — interactive prompts will hang the automation
- Use a dedicated *service account*, not a real person's account (avoids breakage on password rotation / departures)

### 3. Switch CI from "self-start frontend" to "point at deployed env"

Currently [`.github/workflows/frontend-tests-e2e.yml`](../.github/workflows/frontend-tests-e2e.yml) spins up `npm run dev` on the runner and skips backend-dependent tests via `not @SSO`. With a real deployed test env, simplify:

- **Delete** the `Install frontend deps`, `Start frontend dev server`, and `Stop frontend dev server` steps
- **Delete** the `Set up Node 20` step
- **Delete** the `Upload frontend log` step
- In the `Execute Frontend E2E Tests` step, replace the default tag filter and add the environment override:

  ```bash
  if [ -z "$TEST_TAGS" ]; then
    TEST_TAGS="@Regression"            # was: "(@Login or @Navigation or @PublicDisplay) and not @SSO"
  fi
  MAVEN_CMD=(mvn -B $BUILD_TYPE -Denvironment=test "-Dcucumber.filter.tags=$TEST_TAGS")
  ```

You can also drop the Xvfb step if you flip `serenity.conf` to `headless.mode = true` — Xvfb is only needed because the local dev config runs headed.

### 4. (Optional) Migrate Azure Key Vault references

If you adopt the canonical-secrets-in-KV pattern, the original repo mirrored MS creds to `kv-tickets-nodi19` (`ms-test-username` / `ms-test-password`). Recreate the equivalent secrets in your team's vault and document the names; the workflow currently reads directly from GH secrets, not KV.

## Caution

This framework is intended for **non-production** environments only — point it at `local`, `test`, or `staging`. Driving the Microsoft SSO flow against a production tenant with automation is **not** supported.
