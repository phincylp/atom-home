#!/bin/bash
set -x
if [ $# != 3 ]
then
    echo "usage is $0 <1 for unstaged> | <2 for staged>"
    exit 1
fi
ustage=$1
stg=$2
if [ $ustage == 1 ]
then
    echo "executing git clean -df"
elif [ $stg==2 ]
then
    echo "executing git checkout -- ."
else
    echo "usage is $0 <1 for unstaged> | <2 for staged>"
fi
