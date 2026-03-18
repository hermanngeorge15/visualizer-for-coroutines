package com.jh.proj.coroutineviz

import io.ktor.http.ContentType
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.compression.Compression
import io.ktor.server.plugins.compression.deflate
import io.ktor.server.plugins.compression.gzip
import io.ktor.server.plugins.compression.matchContentType
import io.ktor.server.plugins.compression.minimumSize

fun Application.configureCompression() {
    install(Compression) {
        gzip {
            priority = 1.0
            minimumSize(1024)
            matchContentType(
                ContentType.Text.Any,
                ContentType.Application.Json,
                ContentType.Application.JavaScript,
                ContentType.Text.EventStream,
            )
        }
        deflate {
            priority = 0.5
            minimumSize(1024)
            matchContentType(
                ContentType.Text.Any,
                ContentType.Application.Json,
                ContentType.Application.JavaScript,
                ContentType.Text.EventStream,
            )
        }
    }
}
