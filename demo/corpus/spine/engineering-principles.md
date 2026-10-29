# Engineering principles

## SOLID

- **Single Responsibility** - each class has one reason to change. Services do one thing.
  Event subscribers handle one concern.
- **Open/Closed** - extend behaviour via interfaces, event subscribers and composition, not
  by modifying existing classes.
- **Liskov Substitution** - implementations must be substitutable for their interfaces
  without breaking behaviour.
- **Interface Segregation** - keep interfaces small and focused. Prefer multiple specific
  interfaces over one large one.
- **Dependency Inversion** - depend on abstractions, not concrete classes. Constructor
  injection via Symfony DI.

## DRY

Extract shared logic into a shared module. But do not over-abstract:
two similar blocks of code are acceptable if they serve different domain concepts and may
diverge.

## KISS

Prefer the simplest solution that works. No premature abstractions, no speculative
generalisation. A straightforward service method beats an over-engineered pattern.

## YAGNI

Do not build features, abstractions or flexibility for hypothetical future requirements.
Build what is needed now. Refactor when actual needs arise.

## Composition over inheritance

Use `final` classes and compose behaviour via constructor-injected dependencies. Inheritance
is reserved for `abstract` base classes.

## Fail fast

Validate inputs at system boundaries - controllers, commands, message handlers. Value
Objects validate in the constructor. Throw exceptions early rather than passing invalid
state through the system.
