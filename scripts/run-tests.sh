#!/bin/bash

# Comprehensive test runner script for News Curator
# This script provides a convenient way to run tests in various configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

# Function to display usage
show_usage() {
    cat << EOF
${GREEN}News Curator Test Runner${NC}

${BLUE}Usage:${NC}
  ./scripts/run-tests.sh [OPTIONS] [TEST_SUITE]

${BLUE}Test Suites:${NC}
  all                 Run all tests (default)
  api                 Run API tests only
  web                 Run frontend tests only
  shared              Run shared package tests only
  coverage            Run all tests with coverage report

${BLUE}Options:${NC}
  -d, --docker        Run tests in Docker containers
  -w, --watch         Run tests in watch mode (local only)
  -c, --coverage      Generate coverage report
  -h, --help          Show this help message
  --clean             Clean Docker volumes before running

${BLUE}Examples:${NC}
  ./scripts/run-tests.sh                    # Run all tests locally
  ./scripts/run-tests.sh --docker           # Run all tests in Docker
  ./scripts/run-tests.sh api                # Run API tests locally
  ./scripts/run-tests.sh --docker coverage  # Run tests with coverage in Docker
  ./scripts/run-tests.sh --watch api        # Run API tests in watch mode
  ./scripts/run-tests.sh --docker --clean   # Clean and run tests in Docker

EOF
}

# Parse command line arguments
DOCKER=false
WATCH=false
COVERAGE=false
CLEAN=false
TEST_SUITE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--docker)
            DOCKER=true
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        all|api|web|shared|coverage)
            TEST_SUITE=$1
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Handle coverage suite
if [ "$TEST_SUITE" = "coverage" ]; then
    COVERAGE=true
    TEST_SUITE="all"
fi

# Validate options
if [ "$DOCKER" = true ] && [ "$WATCH" = true ]; then
    print_error "Watch mode is not supported with Docker"
    exit 1
fi

# Clean Docker volumes if requested
if [ "$DOCKER" = true ] && [ "$CLEAN" = true ]; then
    print_info "Cleaning Docker test volumes..."
    docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    print_success "Docker volumes cleaned"
fi

# Run tests
print_info "Running ${TEST_SUITE} tests..."
print_info "Mode: $([ "$DOCKER" = true ] && echo "Docker" || echo "Local")"
print_info "Coverage: $([ "$COVERAGE" = true ] && echo "Enabled" || echo "Disabled")"
print_info "Watch: $([ "$WATCH" = true ] && echo "Enabled" || echo "Disabled")"
echo ""

if [ "$DOCKER" = true ]; then
    # Run tests in Docker
    case $TEST_SUITE in
        all)
            if [ "$COVERAGE" = true ]; then
                docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit test-coverage
            else
                docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit test-all
            fi
            ;;
        api)
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit test-api
            ;;
        web)
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit test-web
            ;;
        shared)
            docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit test-shared
            ;;
    esac

    # Get exit code from Docker container
    EXIT_CODE=$?

    # Clean up containers
    print_info "Cleaning up Docker containers..."
    docker-compose -f docker-compose.test.yml down

else
    # Run tests locally
    if [ "$WATCH" = true ]; then
        case $TEST_SUITE in
            all)
                print_warning "Watch mode runs tests in parallel. Press Ctrl+C to stop."
                npm run test:watch
                ;;
            api)
                npm run test:watch --workspace=@news-curator/api
                ;;
            web)
                npm run test:watch --workspace=@news-curator/web
                ;;
            shared)
                npm run test:watch --workspace=@news-curator/shared
                ;;
        esac
    elif [ "$COVERAGE" = true ]; then
        case $TEST_SUITE in
            all)
                npm run test:coverage
                ;;
            api)
                npm run test:coverage --workspace=@news-curator/api
                ;;
            web)
                npm run test:coverage --workspace=@news-curator/web
                ;;
            shared)
                npm run test:coverage --workspace=@news-curator/shared
                ;;
        esac
    else
        case $TEST_SUITE in
            all)
                npm run test:all
                ;;
            api)
                npm run test:api
                ;;
            web)
                npm run test:web
                ;;
            shared)
                npm run test:shared
                ;;
        esac
    fi

    EXIT_CODE=$?
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    print_success "All tests passed!"

    if [ "$COVERAGE" = true ]; then
        print_info "Coverage reports generated:"
        print_info "  - API: packages/api/coverage/index.html"
        print_info "  - Web: packages/web/coverage/index.html"
    fi
else
    print_error "Some tests failed. Exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
