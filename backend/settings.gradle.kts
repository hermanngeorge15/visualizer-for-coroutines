rootProject.name = "backend"

include("coroutine-viz-core")
include("intellij-plugin")
project(":intellij-plugin").projectDir = file("../intellij-plugin")

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
