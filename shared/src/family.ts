/** Family side configuration */
export interface FamilySideConfig {
  id: string;
  name: string;
  color: string;
  groups: string[];
}

/** Person in the family hierarchy */
export interface Person {
  id: string;
  name: string;
  groupId?: string;
  isChild?: boolean;
  familySide?: string;
}

/** Group in the family hierarchy */
export interface Group {
  id: string;
  name: string;
  members: string[];
  familySide?: string;
  description?: string;
}

/** Relationship between family members */
export interface Relationship {
  type: string;
  parent1?: string;
  parent2?: string;
  partner1?: string;
  partner2?: string;
  person1?: string;
  people?: string[];
  children?: string[];
  relation?: string;
}

/** Complete family hierarchy */
export interface FamilyHierarchy {
  version: string;
  family: {
    name: string;
    root: {
      partners: {
        id: string;
        name: string;
        role?: string;
      }[];
    };
    sides?: Record<string, FamilySideConfig>;
    relationships: Relationship[];
    people: Record<string, Person>;
    groups: Record<string, Group>;
  };
}
