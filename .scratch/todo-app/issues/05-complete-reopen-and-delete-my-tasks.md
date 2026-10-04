# 05: Complete, reopen and delete my Tasks

**What to build:** A User can mark one of their Tasks Completed, reopen it, and delete it. Touching another User's Task behaves as if it does not exist.

**Blocked by:** 04: Add and see my own Tasks

**Status:** ready-for-agent

- [ ] The list has a control to toggle Completed and a control to delete; completed Tasks are visibly distinct; delete is permanent
- [ ] The API supports updating Completed and deleting a Task by id
- [ ] Targeting another User's Task, or an id that does not exist, returns 404 and changes nothing; a missing session returns 401
- [ ] Integration tests with two Users prove: User B cannot complete or delete User A's Task, the response is a not-found, and A's Task is unchanged
- [ ] The API handlers stay thin, only translating the data module's result into 401 or 404 (no handler-level tests; see the spec's testing decisions)
- [ ] Two Users can run the whole flow locally and each sees only their own Tasks
