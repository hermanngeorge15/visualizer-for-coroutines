# ADR-021: SDK Distribution

## Status
Accepted

## Date
2026-03-18

## Context
The `coroutine-viz-core` module (ADR-013) exists as a Gradle submodule within the monorepo but is not published to any artifact repository. External projects cannot depend on it without cloning the entire repository. To enable adoption beyond the monorepo — in user applications, CI pipelines, and third-party tools — the core library must be published as a Maven artifact with clear versioning and documentation.

## Decision
Publish `coroutine-viz-core` to GitHub Packages initially, with Maven Central as a follow-up. Additionally, build a CLI tool for CI/CD integration and provide sample applications.

### Maven Coordinates
```
Group:    com.jh.coroutine-viz
Artifact: coroutine-viz-core
Version:  0.1.0
```

### Gradle Publishing Configuration
```kotlin
// coroutine-viz-core/build.gradle.kts
plugins {
    `maven-publish`
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "com.jh.coroutine-viz"
            artifactId = "coroutine-viz-core"
            version = project.version.toString()
            from(components["kotlin"])

            pom {
                name.set("Coroutine Viz Core")
                description.set("Instrumentation and event library for Kotlin coroutine visualization")
                url.set("https://github.com/hermanngeorge15/visualizer-for-coroutines")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
            }
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/hermanngeorge15/visualizer-for-coroutines")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
```

### CI Publishing Workflow
A GitHub Actions workflow publishes on tag push:

```yaml
# .github/workflows/publish-maven.yml
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Publish to GitHub Packages
        run: cd backend && ./gradlew :coroutine-viz-core:publish
        env:
          GITHUB_ACTOR: ${{ github.actor }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Consumer Usage
External projects add the dependency:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        maven {
            url = uri("https://maven.pkg.github.com/hermanngeorge15/visualizer-for-coroutines")
            credentials {
                username = project.findProperty("gpr.user") as String?
                password = project.findProperty("gpr.token") as String?
            }
        }
    }
}

// build.gradle.kts
dependencies {
    implementation("com.jh.coroutine-viz:coroutine-viz-core:0.1.0")
}
```

### Sample Application
Create a `samples/` directory in the monorepo root with a standalone Gradle project demonstrating SDK usage:

```
samples/
└── basic-instrumentation/
    ├── build.gradle.kts          # depends on coroutine-viz-core
    ├── settings.gradle.kts
    └── src/main/kotlin/
        └── Main.kt               # launches VizScope, runs coroutines, prints events
```

The sample app shows:
1. Creating a `VizScope` and launching instrumented coroutines
2. Using `InstrumentedFlow` for flow visualization
3. Using `VizMutex` and `VizSemaphore` for sync primitive visualization
4. Collecting events from the `EventBus` and printing them

### CLI Tool for CI/CD
Build a fat JAR CLI tool that runs validation checks against recorded event traces:

```
java -jar coroutine-viz-ci.jar check \
  --config ci-config.yaml \
  --input events.json \
  --format junit
```

**ci-config.yaml:**
```yaml
rules:
  structured-concurrency: error     # fail if violations found
  deadlock-detection: error
  unhandled-exceptions: warning
  max-coroutine-depth: 10           # warn if hierarchy exceeds depth
  max-parallel-coroutines: 50       # warn if concurrent count exceeds limit
```

**Output formats:** `text` (human-readable), `junit` (JUnit XML for CI), `json` (machine-readable)

### Gradle Task Wrapper
For projects using Gradle, provide a plugin or task that wraps the CLI:

```kotlin
tasks.register<JavaExec>("coroutineVizCheck") {
    classpath = configurations["coroutineVizCli"]
    mainClass.set("com.jh.coroutineviz.cli.MainKt")
    args("check", "--config", "ci-config.yaml", "--input", "build/viz-events.json")
}
```

### Versioning Strategy
- Follow semantic versioning: `MAJOR.MINOR.PATCH`
- `0.x.y` indicates pre-1.0, breaking changes allowed in minor versions
- Tag format: `v0.1.0`, `v0.2.0`, etc.
- CHANGELOG.md maintained in the repository root

## Alternatives Considered

### Maven Central
The gold standard for JVM library distribution. Requires Sonatype OSSRH account setup, GPG signing, and a more complex publishing workflow. Planned as a Phase 2 once the API stabilizes and the library has more users. GitHub Packages is sufficient for early adopters.

### JitPack
Zero-configuration publishing from GitHub repositories. However, JitPack builds are fragile (depend on JitPack's build infrastructure), caching is unreliable, and multi-module projects often require workarounds. Not reliable enough for a library that CI pipelines depend on.

### Fat JAR Distribution Only
Publish a single fat JAR with all dependencies bundled. Simple to distribute but prevents dependency management — consumers cannot exclude or override transitive dependencies, leading to classpath conflicts.

### Gradle Plugin (Instead of CLI)
Package the CI tool as a Gradle plugin rather than a standalone CLI. This limits usage to Gradle projects and adds plugin development/publishing complexity. A CLI jar works with any build system (Gradle, Maven, Bazel, shell scripts).

## Consequences

### Positive
- External projects can depend on `coroutine-viz-core` with standard Gradle/Maven dependency management
- CI/CD integration via CLI tool enables coroutine validation as part of automated pipelines
- Sample app lowers the barrier to entry for new users
- GitHub Packages publishing is fully automated via CI tags
- Semantic versioning provides clear compatibility expectations

### Negative
- GitHub Packages requires authentication to consume (unlike Maven Central) — users must configure credentials
- Maintaining public API stability is a commitment once external consumers exist
- CLI fat JAR adds a build artifact to maintain and test
- Sample app must be kept in sync with API changes in the core library
- Two distribution channels eventually (GitHub Packages + Maven Central) means two publishing workflows

## Related
- ADR-013: Core Library Extraction (the module being published)
- ADR-014: Plugin Communication Protocol (plugin consumes the published artifact)
- ADR-012: Validation Engine Architecture (CLI tool wraps the validation engine)
