import { describe, expect, it } from 'vitest';

import {
  LTI_ROLE_CONTEXT_INSTRUCTOR,
  LTI_ROLE_CONTEXT_LEARNER,
  getLtiMemberDisplayName,
  getLtiNrpsService,
  isLtiMemberInstructor,
  isLtiMemberLearner,
  isLtiNrpsAvailable,
  normalizeLtiNrpsMembersResponse,
  partitionLtiMembersByRoleKind,
  type LTISession,
} from '../src/index.js';

describe('NRPS helpers', () => {
  const session = {
    services: {
      nrps: {
        membershipUrl: 'https://platform.example.com/api/nrps/memberships',
        versions: ['2.0'],
      },
    },
  } as LTISession;

  it('reads NRPS service availability from sessions', () => {
    expect(isLtiNrpsAvailable(session)).toBe(true);
    expect(getLtiNrpsService(session)).toEqual({
      membershipUrl: 'https://platform.example.com/api/nrps/memberships',
      versions: ['2.0'],
    });
    expect(isLtiNrpsAvailable({ services: {} } as LTISession)).toBe(false);
  });

  it('normalizes NRPS membership responses to camelCase members', () => {
    const members = normalizeLtiNrpsMembersResponse({
      id: 'https://platform.example.com/api/nrps/memberships',
      context: { id: 'course-1' },
      members: [
        {
          status: 'Active',
          name: 'Ada Lovelace',
          given_name: 'Ada',
          family_name: 'Lovelace',
          email: 'ada@example.com',
          user_id: 'user-1',
          lis_person_sourcedid: 'sis-1',
          roles: [LTI_ROLE_CONTEXT_LEARNER],
        },
      ],
    });

    expect(members).toEqual([
      {
        status: 'Active',
        name: 'Ada Lovelace',
        givenName: 'Ada',
        familyName: 'Lovelace',
        email: 'ada@example.com',
        userId: 'user-1',
        lisPersonSourcedId: 'sis-1',
        roles: [LTI_ROLE_CONTEXT_LEARNER],
      },
    ]);
  });

  it('derives display names and checks member roles', () => {
    const members = normalizeLtiNrpsMembersResponse({
      id: 'https://platform.example.com/api/nrps/memberships',
      context: { id: 'course-1' },
      members: [
        {
          status: 'Active',
          name: 'Ada Lovelace',
          user_id: 'learner-1',
          roles: [LTI_ROLE_CONTEXT_LEARNER],
        },
        {
          status: 'Active',
          name: '',
          given_name: 'Grace',
          family_name: 'Hopper',
          user_id: 'instructor-1',
          roles: [LTI_ROLE_CONTEXT_INSTRUCTOR],
        },
      ],
    });

    const [learner, instructor] = members;
    if (!learner || !instructor) throw new Error('Expected two NRPS members');

    expect(getLtiMemberDisplayName(learner)).toBe('Ada Lovelace');
    expect(getLtiMemberDisplayName(instructor)).toBe('Grace Hopper');
    expect(isLtiMemberLearner(learner)).toBe(true);
    expect(isLtiMemberInstructor(instructor)).toBe(true);

    const partitioned = partitionLtiMembersByRoleKind(members, 'learner');
    expect(partitioned.matching.map((member) => member.userId)).toEqual(['learner-1']);
    expect(partitioned.rest.map((member) => member.userId)).toEqual(['instructor-1']);
  });
});
