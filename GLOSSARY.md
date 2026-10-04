# To-do App

A web app where each person signs up with a username and password and keeps a private list of tasks that no one else can see.

## Language

**User**:
A person who has signed up and can log in. Every Task belongs to exactly one User.
_Avoid_: Account, member, customer

**Username**:
The unique, lowercase name a User logs in with: 3–20 characters of letters, digits and underscore.
_Avoid_: Handle, login name, nickname

**Profile**:
The record of a User's identity within the app, holding their Username.
_Avoid_: Account, user record

**Task**:
A titled item on a User's list, either open or Completed. Its title is 1–200 characters after trimming.
_Avoid_: Todo, to-do, item, note

**Completed**:
The state of a Task the User has marked done; it can be reopened.
_Avoid_: Done, finished, closed
