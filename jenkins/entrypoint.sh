#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" == "0" ]]; then
  chown jenkins:jenkins /var/jenkins_home

  if [[ -S /var/run/docker.sock ]]; then
    socket_gid="$(stat -c '%g' /var/run/docker.sock)"
    if [[ "$socket_gid" == "0" ]]; then
      socket_group='root'
    else
      socket_group="$(getent group "$socket_gid" | cut -d: -f1 || true)"
      if [[ -z "$socket_group" ]]; then
        socket_group='dockerhost'
        groupadd --gid "$socket_gid" "$socket_group"
      fi
    fi
    usermod --append --groups "$socket_group" jenkins
  fi

  exec gosu jenkins /usr/bin/tini -- /usr/local/bin/jenkins.sh "$@"
fi

exec /usr/bin/tini -- /usr/local/bin/jenkins.sh "$@"
