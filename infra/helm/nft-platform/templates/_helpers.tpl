{{- define "nft-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "nft-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "nft-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "nft-platform.labels" -}}
helm.sh/chart: {{ include "nft-platform.chart" . }}
{{ include "nft-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "nft-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nft-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "nft-platform.backend.labels" -}}
{{ include "nft-platform.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "nft-platform.frontend.labels" -}}
{{ include "nft-platform.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "nft-platform.postgres.labels" -}}
{{ include "nft-platform.labels" . }}
app.kubernetes.io/component: database
{{- end }}

{{- define "nft-platform.redis.labels" -}}
{{ include "nft-platform.labels" . }}
app.kubernetes.io/component: cache
{{- end }}

{{- define "nft-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "nft-platform.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "nft-platform.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.image.repository -}}
{{- $repository := default .Values.image.repository .repository -}}
{{- $tag := default .Values.image.tag .tag -}}
{{- $pullPolicy := default .Values.image.pullPolicy .pullPolicy -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{- define "nft-platform.probe" -}}
{{- $probe := .probe -}}
httpGet:
  path: {{ $probe.path }}
  port: {{ $.port }}
  scheme: HTTP
initialDelaySeconds: {{ $probe.initialDelaySeconds }}
periodSeconds: {{ $probe.periodSeconds }}
timeoutSeconds: {{ $probe.timeoutSeconds }}
failureThreshold: {{ $probe.failureThreshold }}
{{- if $probe.successThreshold }}
successThreshold: {{ $probe.successThreshold }}
{{- end }}
{{- end }}
