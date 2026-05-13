# Mobile App Deploy (Firebase + TestFlight)

Pattern for distributing mobile app builds via Firebase App Distribution (Android) and TestFlight (iOS), triggered from GitLab CI.

## Android: Firebase App Distribution

```yaml
deploy:android:firebase:
  stage: deploy
  image: ghcr.io/cirruslabs/android-sdk:36
  tags:
    - docker
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
    - when: never
  allow_failure: false
  variables:
    APP_BASE_URL: https://staging.example.com/api
  before_script:
    - npm install -g firebase-tools
    - |
      if [ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]; then
        printf '%s' "${FIREBASE_SERVICE_ACCOUNT_JSON}" > "${CI_PROJECT_DIR}/firebase-service-account.json"
        export GOOGLE_APPLICATION_CREDENTIALS="${CI_PROJECT_DIR}/firebase-service-account.json"
      fi
  script:
    - node scripts/prepare-app-release.mjs \
        "${CI_COMMIT_TAG:-0.1.${CI_PIPELINE_IID}}" \
        --code "${CI_PIPELINE_IID}" \
        --android-firebase \
        --signal-base-url "${APP_BASE_URL}"
  environment:
    name: firebase/android-staging
```

### Required CI Variables
- `FIREBASE_ANDROID_STAGING_APP_ID` — Firebase console app ID
- One of: `FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIREBASE_TOKEN`

### Optional
- `FIREBASE_TESTERS` — specific testers or groups
- `FIREBASE_GROUPS` — tester groups
- `APP_BASE_URL` — backend URL for the build

## iOS: TestFlight via altool

```yaml
deploy:ios:testflight:
  stage: deploy
  tags:
    - macos  # Requires macOS runner for Xcode
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
    - when: never
  allow_failure: false
  variables:
    APP_BASE_URL: https://staging.example.com/api
    IOS_EXPORT_METHOD: app-store-connect
  before_script:
    - xcodebuild -version
    - xcrun altool --version
  script:
    - apps/ios/App/Scripts/build-core-xcframework.sh
    - node scripts/prepare-app-release.mjs \
        --ios-testflight \
        --signal-base-url "${APP_BASE_URL}" \
        --ios-export-method "${IOS_EXPORT_METHOD}" \
        --ios-allow-provisioning-updates
  environment:
    name: testflight/ios-staging
```

### Required CI Variables
- `APPLE_TEAM_ID` — Apple Developer Team ID
- `APP_STORE_CONNECT_API_KEY_ID` — API key ID
- `APP_STORE_CONNECT_API_ISSUER_ID` — API issuer ID
- `APP_STORE_CONNECT_API_PRIVATE_KEY` — or macOS runner keychain setup

### Optional
- `IOS_BUNDLE_ID` — Bundle identifier
- `IOS_PROVISIONING_PROFILE` — Profile name
- `IOS_SIGNING_STYLE` — Automatic/manual
- `APP_BASE_URL` — Backend URL

## Common Patterns

- **Manual gate**: both deploys are `when: manual` — triggered by a person, not automatically.
- **Tag trigger**: only runs on `$CI_COMMIT_TAG`.
- **macOS runner**: iOS requires a macOS-based GitLab runner for Xcode tooling.
- **Pre-release script**: `scripts/prepare-app-release.mjs` handles version bumping, native builds, and upload.
