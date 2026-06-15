# Builds the Tickets.WebApi (.NET 10) into a runtime image for Azure Container
# Apps. Built remotely in ACR by .github/workflows/deploy-azure.yml.
#
# Build context is the backend-csharp/ directory (the workflow sets
# appSourcePath to it), so all paths below are relative to backend-csharp/.

# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the build configuration + project files first so `dotnet restore` is
# cached as its own layer and only re-runs when a .csproj or props file changes.
COPY *.sln global.json Directory.Build.props Directory.Packages.props ./
COPY src/Tickets.Domain/*.csproj         src/Tickets.Domain/
COPY src/Tickets.Application/*.csproj     src/Tickets.Application/
COPY src/Tickets.Infrastructure/*.csproj  src/Tickets.Infrastructure/
COPY src/Tickets.WebApi/*.csproj          src/Tickets.WebApi/
RUN dotnet restore src/Tickets.WebApi/Tickets.WebApi.csproj

# Copy the rest of the source and publish a self-contained framework-dependent
# build (the aspnet runtime image already has the .NET runtime).
COPY . .
RUN dotnet publish src/Tickets.WebApi/Tickets.WebApi.csproj \
    -c Release -o /app --no-restore

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# The aspnet base image listens on 8080 by default (ASPNETCORE_HTTP_PORTS=8080);
# the Container App ingress targetPort must match this (see the deploy workflow).
EXPOSE 8080

COPY --from=build /app ./

# Run as the non-root user the base image provides.
USER $APP_UID

ENTRYPOINT ["dotnet", "Tickets.WebApi.dll"]
