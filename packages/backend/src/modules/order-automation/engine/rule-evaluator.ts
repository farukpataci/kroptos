import {
  ConditionGroup,
  ConditionTrace,
  ConditionTree,
  GroupConditionTrace,
  SingleCondition,
  SingleConditionTrace,
} from '../automation-types';
import { evaluateOperator, extractFieldValue } from './condition-registry';

export class RuleEvaluator {
  /**
   * Evaluates a full condition tree against an order and builds a condition trace.
   */
  static evaluate(
    order: any,
    tree: ConditionTree | null | undefined,
  ): { matched: boolean; trace: ConditionTrace } {
    if (!tree || !Array.isArray(tree.conditions) || tree.conditions.length === 0) {
      // Empty condition tree means "match every order" for this trigger
      const emptyTrace: ConditionTrace = {
        rootPassed: true,
        tree: {
          type: 'group',
          operator: 'and',
          passed: true,
          children: [],
        },
      };
      return { matched: true, trace: emptyTrace };
    }

    const groupTrace = this.evaluateGroup(order, {
      operator: tree.operator || 'and',
      conditions: tree.conditions,
    });

    return {
      matched: groupTrace.passed,
      trace: {
        rootPassed: groupTrace.passed,
        tree: groupTrace,
      },
    };
  }

  private static evaluateGroup(
    order: any,
    group: ConditionGroup,
  ): GroupConditionTrace {
    const isAnd = group.operator === 'and';
    const children: Array<SingleConditionTrace | GroupConditionTrace> = [];

    let groupPassed = isAnd; // For AND start true, for OR start false
    if (!isAnd) groupPassed = false;

    for (const item of group.conditions) {
      if ('conditions' in item && Array.isArray((item as ConditionGroup).conditions)) {
        // Nested sub-group (up to 2 levels)
        const subGroupTrace = this.evaluateGroup(order, item as ConditionGroup);
        children.push(subGroupTrace);

        if (isAnd && !subGroupTrace.passed) {
          groupPassed = false;
        } else if (!isAnd && subGroupTrace.passed) {
          groupPassed = true;
        }
      } else {
        // Single condition
        const cond = item as SingleCondition;
        const actualValue = extractFieldValue(order, cond.field);
        const passed = evaluateOperator(actualValue, cond.operator, cond.value);

        const singleTrace: SingleConditionTrace = {
          type: 'condition',
          field: cond.field,
          operator: cond.operator,
          expectedValue: cond.value,
          actualValue,
          passed,
        };
        children.push(singleTrace);

        if (isAnd && !passed) {
          groupPassed = false;
        } else if (!isAnd && passed) {
          groupPassed = true;
        }
      }
    }

    return {
      type: 'group',
      operator: group.operator,
      passed: groupPassed,
      children,
    };
  }
}
